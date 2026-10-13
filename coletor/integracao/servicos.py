"""Regras da integração acadêmica: entrar, consentimento, revogação e apagar a conta.

As rotas só traduzem HTTP para estas funções. Erros de negócio viram ErroIntegracao com um
código estável (o front usa o código, não a mensagem).
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone

from integracao import cpf as cpf_mod
from integracao.config import Config
from integracao.contrato import Vinculo
from integracao.provedores.base import AcademicoIndisponivel, ProvedorAcademico
from integracao.repositorio.base import Repositorio
from integracao.seguranca import LimiteTentativas


class ErroIntegracao(Exception):
    def __init__(self, codigo: str, status: int):
        super().__init__(codigo)
        self.codigo = codigo
        self.status = status


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Servicos:
    config: Config
    repositorio: Repositorio
    provedor: ProvedorAcademico
    autenticador: object  # tem .verificar(cpf_digitos, senha) -> bool
    limite: LimiteTentativas = field(default_factory=LimiteTentativas)

    # ------------------------------------------------------------------ identidade
    def chave_de(self, cpf_digitos: str) -> str:
        return cpf_mod.chave(cpf_digitos, self.config.cpf_pepper)

    def entrar(self, cpf_bruto: str, senha: str, ip: str) -> tuple[Vinculo, str, str]:
        """Devolve (vínculo, chave do aluno, CPF mascarado). Nunca devolve o CPF."""
        if not self.config.sessao_ativa:
            raise ErroIntegracao("sessao_desativada", 503)
        excecao = self.config.demo_digitos if self.config.auth_mode == "demo" else None
        try:
            cpf_d = cpf_mod.normalizar(cpf_bruto, excecao_digitos=excecao)
        except cpf_mod.CpfInvalido as erro:
            raise ErroIntegracao("cpf_invalido", 422) from erro

        chave = self.chave_de(cpf_d)
        limite_chave = f"{ip}|{chave}"
        if self.limite.bloqueado(limite_chave):
            raise ErroIntegracao("muitas_tentativas", 429)
        try:
            autenticado = self.autenticador.verificar(cpf_d, senha)
        except AcademicoIndisponivel as erro:
            raise ErroIntegracao("autenticacao_indisponivel", 503) from erro
        if not autenticado:
            self.limite.falha(limite_chave)
            self._auditar("login_falhou", chave)
            raise ErroIntegracao("credenciais_invalidas", 401)

        try:
            vinculo = self.provedor.vinculo(cpf_d)
        except AcademicoIndisponivel as erro:
            raise ErroIntegracao("academico_indisponivel", 503) from erro
        if vinculo is None or not vinculo.ativo:
            self._auditar("login_sem_vinculo", chave)
            raise ErroIntegracao("vinculo_inativo", 403)

        self.limite.limpar(limite_chave)
        self._auditar("login", chave)
        return vinculo, chave, cpf_mod.mascarar(cpf_d)

    # ----------------------------------------------------------------- consentimento
    def consentimento(self, chave: str) -> dict:
        dados = self.repositorio.consentimento_ler(chave) or {}
        return {
            "aceito": bool(dados.get("aceito")),
            "versao": dados.get("versao"),
            "aceito_em": dados.get("aceito_em"),
        }

    def aceitar(self, chave: str, versao: str) -> dict:
        if versao != self.config.termo_versao:
            raise ErroIntegracao("versao_termo", 422)
        self.repositorio.consentimento_gravar(
            chave, {"aceito": True, "versao": versao, "aceito_em": _agora(), "revogado_em": None}
        )
        self._auditar("consentimento_aceito", chave, versao)
        return self.consentimento(chave)

    def revogar(self, chave: str) -> None:
        """Revoga o consentimento e apaga currículo e marcações. O registro de consentimento fica, com a data."""
        atual = self.repositorio.consentimento_ler(chave) or {}
        self.repositorio.consentimento_gravar(chave, {**atual, "aceito": False, "revogado_em": _agora()})
        self.repositorio.dados_apagar(chave, incluir_consentimento=False)
        self._auditar("consentimento_revogado", chave)

    def apagar_conta(self, chave: str) -> None:
        self.repositorio.dados_apagar(chave, incluir_consentimento=True)
        self._auditar("conta_apagada", chave)

    # ------------------------------------------------------------------ auditoria
    def _auditar(self, evento: str, chave: str, detalhe: str = "") -> None:
        # Sem CPF, nome, e-mail ou IP: só o evento, o prefixo do hash e a data.
        self.repositorio.auditoria_registrar({
            "quando": _agora(),
            "evento": evento,
            "ator": f"aluno:{chave[:8]}",
            "detalhe": detalhe,
        })
