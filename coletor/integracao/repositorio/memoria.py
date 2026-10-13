"""Repositório em memória: usado pelos testes e como reserva local. Não persiste nada."""

import copy

from integracao.repositorio.base import Repositorio


class RepositorioMemoria(Repositorio):
    def __init__(self):
        self._consentimentos: dict[str, dict] = {}
        self._curriculos: dict[str, dict] = {}
        self._marcacoes: dict[str, dict] = {}
        self._auditoria: list[dict] = []

    def consentimento_ler(self, chave):
        dados = self._consentimentos.get(chave)
        return copy.deepcopy(dados) if dados is not None else None

    def consentimento_gravar(self, chave, dados):
        self._consentimentos[chave] = copy.deepcopy(dados)

    def dados_apagar(self, chave, *, incluir_consentimento):
        self._curriculos.pop(chave, None)
        self._marcacoes.pop(chave, None)
        if incluir_consentimento:
            self._consentimentos.pop(chave, None)

    def auditoria_registrar(self, evento):
        self._auditoria.append(copy.deepcopy(evento))

    def auditoria_listar(self, limite):
        return copy.deepcopy(sorted(self._auditoria, key=lambda e: e["quando"], reverse=True)[:limite])
