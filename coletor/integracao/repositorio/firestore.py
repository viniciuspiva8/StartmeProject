"""Repositório no Firestore (produção). Recebe o cliente do coletor, então funciona com o FakeDB dos testes."""

from integracao.repositorio.base import Repositorio

COL_CONSENTIMENTOS = "aluno_consentimentos"
COL_CURRICULOS = "aluno_curriculos"
COL_MARCACOES = "aluno_marcacoes"
COL_AUDITORIA = "auditoria"
COL_ADMINISTRADORES = "administradores"
COL_SISTEMA = "sistema"


class RepositorioFirestore(Repositorio):
    def __init__(self, db):
        self._db = db

    def consentimento_ler(self, chave):
        snap = self._db.collection(COL_CONSENTIMENTOS).document(chave).get()
        return snap.to_dict() if snap.exists else None

    def consentimento_gravar(self, chave, dados):
        self._db.collection(COL_CONSENTIMENTOS).document(chave).set(dados)

    def curriculo_ler(self, chave):
        snap = self._db.collection(COL_CURRICULOS).document(chave).get()
        return snap.to_dict() if snap.exists else None

    def curriculo_gravar(self, chave, dados):
        self._db.collection(COL_CURRICULOS).document(chave).set(dados)

    def marcacoes_ler(self, chave):
        snap = self._db.collection(COL_MARCACOES).document(chave).get()
        return snap.to_dict() if snap.exists else None

    def marcacoes_gravar(self, chave, dados):
        self._db.collection(COL_MARCACOES).document(chave).set(dados)

    def dados_apagar(self, chave, *, incluir_consentimento):
        self._db.collection(COL_CURRICULOS).document(chave).delete()
        self._db.collection(COL_MARCACOES).document(chave).delete()
        if incluir_consentimento:
            self._db.collection(COL_CONSENTIMENTOS).document(chave).delete()

    def admin_ler(self, email):
        snap = self._db.collection(COL_ADMINISTRADORES).document(email).get()
        return snap.to_dict() if snap.exists else None

    def admin_gravar(self, email, dados):
        self._db.collection(COL_ADMINISTRADORES).document(email).set(dados)

    def sistema_ler(self, chave):
        snap = self._db.collection(COL_SISTEMA).document(chave).get()
        return snap.to_dict() if snap.exists else None

    def sistema_gravar(self, chave, dados):
        self._db.collection(COL_SISTEMA).document(chave).set(dados)

    def estatisticas(self, mes):
        # Contagens simples: o painel é usado por poucas pessoas e poucas vezes ao dia.
        vagas = [d.to_dict() for d in self._db.collection("vagas").stream()]
        consentimentos = [d.to_dict() for d in self._db.collection(COL_CONSENTIMENTOS).stream()]
        cota = self._db.collection("controle_serpapi").document(mes).get()
        datas = [v.get("data_coleta") for v in vagas if v.get("data_coleta")]
        return {
            "vagas": len(vagas),
            "cota_usadas": int((cota.to_dict() or {}).get("buscas", 0)) if cota.exists else 0,
            "ultima_coleta": max(datas) if datas else None,
            "consentimentos_ativos": sum(1 for c in consentimentos if c.get("aceito")),
            "consentimentos_total": len(consentimentos),
        }

    def auditoria_registrar(self, evento):
        self._db.collection(COL_AUDITORIA).document().set(evento)

    def auditoria_listar(self, limite):
        # Poucos eventos por semana: ordenação em Python evita índice composto no Firestore.
        eventos = [doc.to_dict() for doc in self._db.collection(COL_AUDITORIA).stream()]
        return sorted(eventos, key=lambda e: e["quando"], reverse=True)[:limite]
