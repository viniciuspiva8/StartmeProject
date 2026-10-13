"""Configuração da integração, lida do ambiente e validada na subida.

Padrões seguros: sem SESSAO_SEGREDO não há sessão (a API responde 503 e o front usa o modo local).
"""

import os
from dataclasses import dataclass
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

    def __post_init__(self):
        if self.auth_mode not in MODOS_AUTH:
            raise ValueError(f"AUTH_MODE inválido: {self.auth_mode!r}")
        if self.provedor not in PROVEDORES:
            raise ValueError(f"ACADEMICO_PROVIDER inválido: {self.provedor!r}")
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

        arquivo = env.get("ACADEMICO_ARQUIVO", "").strip()
        return cls(
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
