"""Repositório em memória: usado pelos testes e como reserva local. Não persiste nada."""

import copy

from integracao.repositorio.base import Repositorio


class RepositorioMemoria(Repositorio):
    def __init__(self):
        self._consentimentos: dict[str, dict] = {}
        self._curriculos: dict[str, dict] = {}
        self._marcacoes: dict[str, dict] = {}
        self._auditoria: list[dict] = []
        self._admins: dict[str, dict] = {}
        self._sistema: dict[str, dict] = {}
        self.vagas: list[dict] = []  # para estatísticas de teste
        self.cota: dict[str, int] = {}

    def consentimento_ler(self, chave):
        dados = self._consentimentos.get(chave)
        return copy.deepcopy(dados) if dados is not None else None

    def consentimento_gravar(self, chave, dados):
        self._consentimentos[chave] = copy.deepcopy(dados)

    def curriculo_ler(self, chave):
        dados = self._curriculos.get(chave)
        return copy.deepcopy(dados) if dados is not None else None

    def curriculo_gravar(self, chave, dados):
        self._curriculos[chave] = copy.deepcopy(dados)

    def marcacoes_ler(self, chave):
        dados = self._marcacoes.get(chave)
        return copy.deepcopy(dados) if dados is not None else None

    def marcacoes_gravar(self, chave, dados):
        self._marcacoes[chave] = copy.deepcopy(dados)

    def dados_apagar(self, chave, *, incluir_consentimento):
        self._curriculos.pop(chave, None)
        self._marcacoes.pop(chave, None)
        if incluir_consentimento:
            self._consentimentos.pop(chave, None)

    def admin_ler(self, email):
        dados = self._admins.get(email)
        return copy.deepcopy(dados) if dados is not None else None

    def admin_gravar(self, email, dados):
        self._admins[email] = copy.deepcopy(dados)

    def sistema_ler(self, chave):
        dados = self._sistema.get(chave)
        return copy.deepcopy(dados) if dados is not None else None

    def sistema_gravar(self, chave, dados):
        self._sistema[chave] = copy.deepcopy(dados)

    def estatisticas(self, mes):
        ultima = max((v.get("data_coleta") for v in self.vagas if v.get("data_coleta")), default=None)
        return {
            "vagas": len(self.vagas), "cota_usadas": self.cota.get(mes, 0), "ultima_coleta": ultima,
            "consentimentos_ativos": sum(1 for c in self._consentimentos.values() if c.get("aceito")),
            "consentimentos_total": len(self._consentimentos),
        }

    def auditoria_registrar(self, evento):
        self._auditoria.append(copy.deepcopy(evento))

    def auditoria_listar(self, limite):
        return copy.deepcopy(sorted(self._auditoria, key=lambda e: e["quando"], reverse=True)[:limite])
