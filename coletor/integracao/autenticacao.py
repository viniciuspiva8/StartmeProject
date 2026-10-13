"""Autenticação do aluno: modo demo (fase 2) e modo http (fase 3). O modo oidc entra na fase 5.

Os modos devolvem sempre um bool. Falha da fonte de autenticação vira AcademicoIndisponivel.
"""

import hmac
import logging
from typing import Callable

import requests

from integracao.config import Config
from integracao.cpf import digitos
from integracao.provedores.base import AcademicoIndisponivel
from integracao.provedores.sql import formatar_cpf

log = logging.getLogger("startme.integracao")


class AutenticadorDemo:
    """Aceita só o CPF e a senha de demonstração, comparados em tempo constante."""

    def __init__(self, config: Config):
        self._cpf = config.demo_digitos
        self._senha = config.demo_senha.encode("utf-8")

    def verificar(self, cpf_digitos: str, senha: str) -> bool:
        cpf_ok = hmac.compare_digest(cpf_digitos.encode("ascii"), self._cpf.encode("ascii"))
        senha_ok = hmac.compare_digest(senha.encode("utf-8"), self._senha)
        return cpf_ok and senha_ok


class AutenticadorHttp:
    """Envia {cpf, senha} à fonte da faculdade: 200 aceita, 401/403/404 recusa, o resto é indisponível."""

    def __init__(self, url: str, cpf_formato: str, timeout: float, http_post: Callable = requests.post):
        self._url = url
        self._formato = cpf_formato
        self._timeout = timeout
        self._post = http_post

    def verificar(self, cpf_digitos: str, senha: str) -> bool:
        cpf_enviado = formatar_cpf(cpf_digitos) if self._formato == "pontuado" else digitos(cpf_digitos)
        try:
            resposta = self._post(self._url, json={"cpf": cpf_enviado, "senha": senha}, timeout=self._timeout)
        except requests.RequestException as erro:
            log.warning("autenticação http indisponível (%s)", type(erro).__name__)
            raise AcademicoIndisponivel("autenticação HTTP falhou") from erro
        if resposta.status_code == 200:
            return True
        if resposta.status_code in (401, 403, 404):
            return False
        log.warning("autenticação http respondeu %s", resposta.status_code)
        raise AcademicoIndisponivel(f"autenticação respondeu {resposta.status_code}")


def construir(config: Config):
    if config.auth_mode == "demo":
        return AutenticadorDemo(config)
    if config.auth_mode == "http":
        if not config.auth_http_url:
            raise ValueError("AUTH_HTTP_URL é obrigatória com AUTH_MODE=http")
        if not config.auth_http_url.startswith("https://") and not config.ambiente_local:
            raise ValueError("AUTH_HTTP_URL precisa usar https: a senha do aluno trafega nela")
        return AutenticadorHttp(config.auth_http_url, config.cpf_formato, config.timeout)
    raise NotImplementedError(f"modo de autenticação {config.auth_mode!r} ainda não implementado")
