"""Repositório no Firestore (produção). Recebe o cliente do coletor, então funciona com o FakeDB dos testes."""

from integracao.repositorio.base import Repositorio

COL_CONSENTIMENTOS = "aluno_consentimentos"
COL_CURRICULOS = "aluno_curriculos"
COL_MARCACOES = "aluno_marcacoes"
COL_AUDITORIA = "auditoria"


class RepositorioFirestore(Repositorio):
    def __init__(self, db):
        self._db = db

    def consentimento_ler(self, chave):
        snap = self._db.collection(COL_CONSENTIMENTOS).document(chave).get()
        return snap.to_dict() if snap.exists else None

    def consentimento_gravar(self, chave, dados):
        self._db.collection(COL_CONSENTIMENTOS).document(chave).set(dados)

    def dados_apagar(self, chave, *, incluir_consentimento):
        self._db.collection(COL_CURRICULOS).document(chave).delete()
        self._db.collection(COL_MARCACOES).document(chave).delete()
        if incluir_consentimento:
            self._db.collection(COL_CONSENTIMENTOS).document(chave).delete()

    def auditoria_registrar(self, evento):
        self._db.collection(COL_AUDITORIA).document().set(evento)

    def auditoria_listar(self, limite):
        # Poucos eventos por semana: ordenação em Python evita índice composto no Firestore.
        eventos = [doc.to_dict() for doc in self._db.collection(COL_AUDITORIA).stream()]
        return sorted(eventos, key=lambda e: e["quando"], reverse=True)[:limite]
