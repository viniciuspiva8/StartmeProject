"""Autenticação do aluno. Fase 2: modo demo (CPF e senha de demonstração).

Os modos `http` (Fase 3) e `oidc` (Fase 5) ficam atrás da mesma interface.
"""

import hmac

from integracao.config import Config


class AutenticadorDemo:
    """Aceita só o CPF e a senha de demonstração, comparados em tempo constante."""

    def __init__(self, config: Config):
        self._cpf = config.demo_digitos
        self._senha = config.demo_senha.encode("utf-8")

    def verificar(self, cpf_digitos: str, senha: str) -> bool:
        cpf_ok = hmac.compare_digest(cpf_digitos.encode("ascii"), self._cpf.encode("ascii"))
        senha_ok = hmac.compare_digest(senha.encode("utf-8"), self._senha)
        return cpf_ok and senha_ok


def construir(config: Config) -> AutenticadorDemo:
    if config.auth_mode == "demo":
        return AutenticadorDemo(config)
    raise NotImplementedError(f"modo de autenticação {config.auth_mode!r} ainda não implementado")
