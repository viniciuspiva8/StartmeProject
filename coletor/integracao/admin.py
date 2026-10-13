"""Administração do StartMe: login de administradores, resumo, coleta manual e auditoria.

Senhas de administrador ficam em argon2. Papéis: `admin` (tudo) e `leitor` (ver, sem disparar coleta).
Nenhuma ação aqui recebe ou devolve dados pessoais de alunos.
"""

import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from integracao.config import Config
from integracao.repositorio.base import Repositorio
from integracao.seguranca import LimiteTentativas
from integracao.servicos import ErroIntegracao

PAPEIS = ("admin", "leitor")
COLETA_CUSTO_MINIMO = 16  # buscas que uma coleta gasta (2 consultas x 8 localizações)
INTERVALO_COLETA_MANUAL = 3600  # segundos entre coletas manuais
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}$")
_hasher = PasswordHasher()
_HASH_FALSO = _hasher.hash("senha-falsa-para-igualar-o-tempo-de-resposta")


def normalizar_email(valor: str | None) -> str:
    email = (valor or "").strip().lower()
    if not _EMAIL.match(email):
        raise ErroIntegracao("email_invalido", 422)
    return email


def hash_senha(senha: str) -> str:
    return _hasher.hash(senha)


def verificar_senha(hash_guardado: str, senha: str) -> bool:
    try:
        return _hasher.verify(hash_guardado, senha)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class ServicosAdmin:
    config: Config
    repositorio: Repositorio
    limite: LimiteTentativas
    coleta: Callable | None  # coleta(db) -> resultado da mesma coleta da rota pública
    db: object = None  # cliente do Firestore usado pela coleta

    def entrar(self, email_bruto: str, senha: str, ip: str) -> tuple[str, str]:
        """Devolve (e-mail, papel). Erro genérico para e-mail inexistente e senha errada."""
        if not self.config.sessao_ativa:
            raise ErroIntegracao("sessao_desativada", 503)
        try:
            email = normalizar_email(email_bruto)
        except ErroIntegracao:
            raise ErroIntegracao("credenciais_invalidas", 401) from None
        chave_limite = f"admin|{ip}|{email}"
        if self.limite.bloqueado(chave_limite):
            raise ErroIntegracao("muitas_tentativas", 429)
        registro = self.repositorio.admin_ler(email)
        if registro is None or not registro.get("ativo", True):
            verificar_senha(_HASH_FALSO, senha)  # mesmo custo de CPU de uma senha real
            self.limite.falha(chave_limite)
            raise ErroIntegracao("credenciais_invalidas", 401)
        if not verificar_senha(registro["senha_hash"], senha):
            self.limite.falha(chave_limite)
            self._auditar("admin_login_falhou", email)
            raise ErroIntegracao("credenciais_invalidas", 401)
        self.limite.limpar(chave_limite)
        self._auditar("admin_login", email)
        return email, registro.get("papel", "leitor")

    def resumo(self) -> dict:
        mes = time.strftime("%Y-%m", time.gmtime())
        dados = self.repositorio.estatisticas(mes)
        return {
            "vagas": dados["vagas"],
            "cota": {"usadas": dados["cota_usadas"], "limite": self.config.serpapi_limite_mensal},
            "ultima_coleta": dados["ultima_coleta"],
            "consentimentos": {"ativos": dados["consentimentos_ativos"], "total": dados["consentimentos_total"]},
        }

    def coletar(self, email: str, papel: str) -> dict:
        if papel != "admin":
            raise ErroIntegracao("sem_permissao", 403)
        resumo = self.resumo()
        restante = resumo["cota"]["limite"] - resumo["cota"]["usadas"]
        if restante < COLETA_CUSTO_MINIMO:
            raise ErroIntegracao("cota_insuficiente", 429)
        ultima = self.repositorio.sistema_ler("ultima_coleta_manual") or {}
        if ultima.get("em") and time.time() - float(ultima["em"]) < INTERVALO_COLETA_MANUAL:
            raise ErroIntegracao("aguarde_para_coletar", 429)
        self.repositorio.sistema_gravar("ultima_coleta_manual", {"em": time.time(), "por": email})
        if self.coleta is None:
            raise ErroIntegracao("coleta_indisponivel", 503)
        resultado = self.coleta(self.db)
        self._auditar("coleta_manual", email)
        return resultado if isinstance(resultado, dict) else resultado.model_dump()

    def auditoria(self, limite: int) -> list[dict]:
        return self.repositorio.auditoria_listar(limite)

    def _auditar(self, evento: str, email: str) -> None:
        self.repositorio.auditoria_registrar({
            "quando": _agora(),
            "evento": evento,
            "ator": f"admin:{email}",
            "detalhe": "",
        })


def criar_admin(repositorio: Repositorio, email_bruto: str, senha: str, papel: str = "admin") -> str:
    """Cria (ou troca a senha de) um administrador. Usado pela CLI; nunca pela API pública."""
    email = normalizar_email(email_bruto)
    if papel not in PAPEIS:
        raise ValueError(f"papel inválido: {papel!r}")
    if len(senha) < 12:
        raise ValueError("a senha do administrador precisa ter pelo menos 12 caracteres")
    repositorio.admin_gravar(email, {"senha_hash": hash_senha(senha), "papel": papel, "ativo": True, "criado_em": _agora()})
    return email
