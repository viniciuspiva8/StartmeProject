"""Configuração da integração, lida do ambiente e validada na subida.

Padrões seguros: sem SESSAO_SEGREDO não há sessão (a API responde 503 e o front usa o modo local).
"""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

MODOS_AUTH = ("demo", "oidc", "http")
PROVEDORES = ("arquivo", "sql", "http")
ARQUIVO_PADRAO = Path(__file__).parent / "dados" / "alunos_ficticios.json"


@dataclass(frozen=True)
class Config:
    auth_mode: str = "demo"
    provedor: str = "arquivo"
    simulado: bool = True
    termo_versao: str = "2026-10"
    sessao_segredo: bytes | None = None
    cpf_pepper: bytes | None = None
    demo_cpf: str = "000.000.000-00"
    demo_senha: str = "senha"
    arquivo_alunos: Path = ARQUIVO_PADRAO
    ambiente_local: bool = False  # AMBIENTE=local: cookie sem Secure (só desenvolvimento)
    oidc_issuer: str | None = None
    # provedor sql (somente leitura; a consulta deve ser um SELECT com :cpf)
    sql_url: str | None = None
    sql_consulta: str = "SELECT nome, curso, semestre, (situacao = 'ATIVO') AS ativo FROM vw_startme WHERE cpf = :cpf"
    # provedor http e autenticação http
    http_url: str | None = None  # contém {cpf}
    http_cabecalhos: dict = field(default_factory=dict)
    http_mapa: dict = field(default_factory=dict)
    auth_http_url: str | None = None
    cpf_formato: str = "digitos"  # digitos | pontuado
    timeout: float = 5.0

    def __post_init__(self):
        if self.auth_mode not in MODOS_AUTH:
            raise ValueError(f"AUTH_MODE inválido: {self.auth_mode!r}")
        if self.provedor not in PROVEDORES:
            raise ValueError(f"ACADEMICO_PROVIDER inválido: {self.provedor!r}")
        if self.cpf_formato not in ("digitos", "pontuado"):
            raise ValueError("ACADEMICO_CPF_FORMATO deve ser 'digitos' ou 'pontuado'")
        if self.timeout <= 0 or self.timeout > 30:
            raise ValueError("ACADEMICO_TIMEOUT deve estar entre 0 e 30 segundos")
        for nome, valor in (("SESSAO_SEGREDO", self.sessao_segredo), ("CPF_PEPPER", self.cpf_pepper)):
            if valor is not None and len(valor) < 32:
                raise ValueError(f"{nome} precisa ter pelo menos 32 bytes")

    @property
    def sessao_ativa(self) -> bool:
        return self.sessao_segredo is not None and self.cpf_pepper is not None

    @property
    def demo_digitos(self) -> str:
        return "".join(c for c in self.demo_cpf if c.isdigit())

    @classmethod
    def do_ambiente(cls, env=os.environ) -> "Config":
        def binario(nome: str) -> bytes | None:
            valor = env.get(nome, "").strip()
            return valor.encode("utf-8") if valor else None

        def json_de(nome: str, padrao: dict) -> dict:
            bruto = env.get(nome, "").strip()
            if not bruto:
                return padrao
            try:
                valor = json.loads(bruto)
            except json.JSONDecodeError as erro:
                raise ValueError(f"{nome} não é um JSON válido") from erro
            if not isinstance(valor, dict):
                raise ValueError(f"{nome} deve ser um objeto JSON")
            return valor

        arquivo = env.get("ACADEMICO_ARQUIVO", "").strip()
        return cls(
            sql_url=env.get("ACADEMICO_SQL_URL", "").strip() or None,
            sql_consulta=env.get("ACADEMICO_SQL_CONSULTA", "").strip() or cls.sql_consulta,
            http_url=env.get("ACADEMICO_HTTP_URL", "").strip() or None,
            http_cabecalhos=json_de("ACADEMICO_HTTP_CABECALHOS", {}),
            http_mapa=json_de("ACADEMICO_HTTP_MAPA", {}),
            auth_http_url=env.get("AUTH_HTTP_URL", "").strip() or None,
            cpf_formato=env.get("ACADEMICO_CPF_FORMATO", "digitos").strip() or "digitos",
            timeout=float(env.get("ACADEMICO_TIMEOUT", "5") or 5),
            auth_mode=env.get("AUTH_MODE", "demo").strip() or "demo",
            provedor=env.get("ACADEMICO_PROVIDER", "arquivo").strip() or "arquivo",
            simulado=env.get("SIMULADO", "true").strip().lower() != "false",
            termo_versao=env.get("TERMO_VERSAO", "2026-10").strip() or "2026-10",
            sessao_segredo=binario("SESSAO_SEGREDO"),
            cpf_pepper=binario("CPF_PEPPER"),
            demo_cpf=env.get("DEMO_CPF", "000.000.000-00"),
            demo_senha=env.get("DEMO_SENHA", "senha"),
            arquivo_alunos=Path(arquivo) if arquivo else ARQUIVO_PADRAO,
            ambiente_local=env.get("AMBIENTE", "").strip().lower() == "local",
            oidc_issuer=env.get("OIDC_ISSUER", "").strip() or None,
        )

    def publico(self) -> dict:
        """O que o front pode saber sem login (nada sensível)."""
        return {
            "modo_auth": self.auth_mode,
            "provedor": self.provedor,
            "simulado": self.simulado,
            "versao_termo": self.termo_versao,
            "sessao_ativa": self.sessao_ativa,
            "oidc": self.auth_mode == "oidc" and self.oidc_issuer is not None,
        }
