"""Provedor HTTP: consulta um endpoint da faculdade e traduz a resposta pelo mapa de caminhos.

O mapa (ACADEMICO_HTTP_MAPA) diz onde estão nome, curso, semestre e situação dentro do JSON da FSA.
Assim a mesma aplicação serve para formatos de resposta diferentes sem mudar código.
"""

import logging
from typing import Callable

import requests
from pydantic import ValidationError

from integracao.contrato import Vinculo
from integracao.cpf import digitos
from integracao.provedores.base import AcademicoIndisponivel, ProvedorAcademico
from integracao.provedores.sql import formatar_cpf

log = logging.getLogger("startme.integracao")
AUSENTE = object()
CHAVES_OBRIGATORIAS = ("curso", "semestre", "ativo")


def ler_caminho(corpo, caminho: str):
    """Navega 'A.B.C' num dicionário. Devolve AUSENTE quando algum passo não existe."""
    atual = corpo
    for parte in caminho.split("."):
        if not isinstance(atual, dict) or parte not in atual:
            return AUSENTE
        atual = atual[parte]
    return atual


def validar_mapa(mapa: dict) -> None:
    for chave in CHAVES_OBRIGATORIAS:
        if chave not in mapa:
            raise ValueError(f"ACADEMICO_HTTP_MAPA precisa informar '{chave}'")
    ativo = mapa["ativo"]
    if isinstance(ativo, dict) and "caminho" not in ativo:
        raise ValueError("ACADEMICO_HTTP_MAPA: 'ativo' precisa de 'caminho'")


class ProvedorHttp(ProvedorAcademico):
    nome = "http"

    def __init__(
        self,
        url_modelo: str,
        mapa: dict,
        cabecalhos: dict | None = None,
        cpf_formato: str = "digitos",
        timeout: float = 5.0,
        http_get: Callable = requests.get,
        ambiente_local: bool = False,
    ):
        if "{cpf}" not in url_modelo:
            raise ValueError("ACADEMICO_HTTP_URL precisa conter {cpf}")
        if not url_modelo.startswith("https://") and not ambiente_local:
            raise ValueError("ACADEMICO_HTTP_URL precisa usar https (ou AMBIENTE=local)")
        validar_mapa(mapa)
        self._url = url_modelo
        self._mapa = mapa
        self._cabecalhos = cabecalhos or {}
        self._formato = cpf_formato
        self._timeout = timeout
        self._get = http_get

    def _cpf_na_url(self, cpf_digitos: str) -> str:
        return formatar_cpf(cpf_digitos) if self._formato == "pontuado" else digitos(cpf_digitos)

    def vinculo(self, cpf_digitos: str) -> Vinculo | None:
        url = self._url.replace("{cpf}", self._cpf_na_url(cpf_digitos))
        try:
            resposta = self._get(url, headers=self._cabecalhos, timeout=self._timeout)
        except requests.RequestException as erro:
            # A mensagem da biblioteca costuma trazer a URL (com o CPF): não repassa.
            log.warning("fonte acadêmica http indisponível (%s)", type(erro).__name__)
            raise AcademicoIndisponivel("requisição HTTP falhou") from erro
        if resposta.status_code == 404:
            return None
        if resposta.status_code >= 400:
            log.warning("fonte acadêmica http respondeu %s", resposta.status_code)
            raise AcademicoIndisponivel(f"status {resposta.status_code}")
        try:
            corpo = resposta.json()
        except ValueError as erro:
            raise AcademicoIndisponivel("resposta não é JSON") from erro
        return self.mapear(corpo)

    def mapear(self, corpo) -> Vinculo:
        """Traduz o JSON da fonte para o contrato. Campo ausente ⇒ resposta fora do contrato."""
        ativo_spec = self._mapa["ativo"]
        if isinstance(ativo_spec, dict):
            valor_ativo = ler_caminho(corpo, ativo_spec["caminho"])
            aceitos = ativo_spec.get("em", [True])
            ativo = valor_ativo is not AUSENTE and valor_ativo in aceitos
        else:
            valor_ativo = ler_caminho(corpo, ativo_spec)
            ativo = valor_ativo is not AUSENTE and bool(valor_ativo)
        curso = ler_caminho(corpo, self._mapa["curso"])
        semestre = ler_caminho(corpo, self._mapa["semestre"])
        nome = ler_caminho(corpo, self._mapa["nome"]) if "nome" in self._mapa else AUSENTE
        if valor_ativo is AUSENTE or curso is AUSENTE or semestre is AUSENTE:
            raise AcademicoIndisponivel("resposta HTTP fora do contrato")
        try:
            return Vinculo(
                ativo=ativo,
                curso=str(curso),
                semestre=int(semestre),
                nome=None if nome in (AUSENTE, None) else str(nome),
            )
        except (ValueError, TypeError, ValidationError) as erro:
            raise AcademicoIndisponivel("resposta HTTP fora do contrato") from erro
