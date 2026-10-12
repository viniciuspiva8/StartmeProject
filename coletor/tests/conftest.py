"""Fixtures compartilhadas: Firestore falso em memoria e respostas da SerpApi."""
import copy
import json
from pathlib import Path

import pytest
from google.cloud.firestore_v1 import Increment

from tests.helpers import FakeResposta  # noqa: F401

FIXTURE = Path(__file__).parent / "fixtures" / "serpapi_google_jobs.json"


# --------------------------------------------------------------------------
# Firestore falso (so a superficie que o coletor usa)
# --------------------------------------------------------------------------
class FakeSnap:
    def __init__(self, doc_id, dados, ref):
        self.id = doc_id
        self.exists = dados is not None
        self._dados = dados
        self.reference = ref

    def to_dict(self):
        return copy.deepcopy(self._dados) if self._dados is not None else None


class FakeDoc:
    def __init__(self, colecao, doc_id):
        self._colecao = colecao
        self.id = doc_id

    def get(self):
        return FakeSnap(self.id, self._colecao.dados.get(self.id), self)

    def set(self, dados, merge=False):
        atual = self._colecao.dados.get(self.id) if merge else None
        novo = dict(atual or {})
        for chave, valor in dados.items():
            if isinstance(valor, Increment):
                novo[chave] = novo.get(chave, 0) + valor.value
            else:
                novo[chave] = valor
        self._colecao.dados[self.id] = novo

    def update(self, dados):
        if self.id not in self._colecao.dados:
            raise KeyError(f"documento {self.id} nao existe")
        self._colecao.dados[self.id].update(dados)

    def delete(self):
        self._colecao.dados.pop(self.id, None)


class FakeQuery:
    def __init__(self, colecao, filtro):
        self._colecao = colecao
        self._filtro = filtro

    def stream(self):
        campo, op, valor = self._filtro.field_path, self._filtro.op_string, self._filtro.value
        assert op == "<", "o fake so implementa '<'"
        for doc_id, dados in list(self._colecao.dados.items()):
            if campo in dados and dados[campo] < valor:
                yield FakeSnap(doc_id, dados, FakeDoc(self._colecao, doc_id))


class FakeCollection:
    def __init__(self):
        self.dados = {}
        self._auto = 0
        self.leituras = 0  # documentos lidos por stream(): o que o Firestore cobraria

    def document(self, doc_id=None):
        if doc_id is None:
            self._auto += 1
            doc_id = f"auto{self._auto}"
        return FakeDoc(self, doc_id)

    def stream(self):
        for doc_id, dados in list(self.dados.items()):
            self.leituras += 1
            yield FakeSnap(doc_id, dados, FakeDoc(self, doc_id))

    def where(self, filter):  # noqa: A002 - mesmo nome do argumento real
        return FakeQuery(self, filter)


class FakeBatch:
    def __init__(self):
        self._ops = []

    def set(self, ref, dados):
        self._ops.append(lambda: ref.set(dados))

    def update(self, ref, dados):
        self._ops.append(lambda: ref.update(dados))

    def delete(self, ref):
        self._ops.append(ref.delete)

    def commit(self):
        for op in self._ops:
            op()
        self._ops = []


class FakeDB:
    def __init__(self):
        self.colecoes = {}

    def collection(self, nome):
        return self.colecoes.setdefault(nome, FakeCollection())

    def batch(self):
        return FakeBatch()

    def get_all(self, refs):
        return [ref.get() for ref in refs]

    # atalhos de teste
    def docs(self, nome):
        return self.collection(nome).dados


@pytest.fixture
def fake_db():
    return FakeDB()


# --------------------------------------------------------------------------
# SerpApi
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def resposta_serpapi():
    """Resposta real de google_jobs (sem a api_key). Devolve copias independentes."""
    bruto = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return lambda: copy.deepcopy(bruto)


@pytest.fixture
def serpapi_http(monkeypatch):
    """Substitui requests.get da fonte. Nenhum teste chama a SerpApi de verdade.

    `.responder` define o corpo (ou uma funcao params -> FakeResposta);
    `.chamadas` guarda os params de cada chamada.
    """
    from fontes import serpapi

    class Espiao:
        def __init__(self):
            self.chamadas = []  # params de cada BUSCA (search.json)
            self.responder = lambda params: FakeResposta({"jobs_results": []})
            self.downloads = []  # URLs de imagem pedidas
            self.imagens = {}  # url -> bytes | FakeResposta | Exception (padrao: 404)

    espiao = Espiao()

    def falso_get(url, params=None, timeout=None, **kwargs):
        if "/search.json" in url:
            espiao.chamadas.append(dict(params or {}))
            resultado = espiao.responder(dict(params or {}))
        else:
            espiao.downloads.append(url)
            resultado = espiao.imagens.get(url, FakeResposta(b"", status_code=404, reason="Not Found"))
            if isinstance(resultado, bytes):
                resultado = FakeResposta(resultado)
        if isinstance(resultado, Exception):
            raise resultado
        return resultado

    monkeypatch.setattr(serpapi.requests, "get", falso_get)
    return espiao


@pytest.fixture(autouse=True)
def ambiente_limpo(monkeypatch):
    """Isola os testes das variaveis SERPAPI_* do ambiente do desenvolvedor."""
    for nome in (
        "SERPAPI_KEY", "SERPAPI_QUERIES", "SERPAPI_LOCALIZACOES", "SERPAPI_MAX_PAGINAS",
        "SERPAPI_LIMITE_MENSAL", "SERPAPI_MAX_BUSCAS_EXEC", "VAGA_TTL_DIAS", "SERPAPI_TIMEOUT",
    ):
        monkeypatch.delenv(nome, raising=False)


@pytest.fixture(autouse=True)
def sem_espera(monkeypatch):
    """As novas tentativas esperam alguns segundos de verdade; nos testes, nao."""
    from fontes import serpapi

    esperas = []
    monkeypatch.setattr(serpapi.time, "sleep", lambda segundos: esperas.append(segundos))
    return esperas
