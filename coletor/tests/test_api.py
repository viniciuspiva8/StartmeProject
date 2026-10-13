"""Testes das rotas HTTP. Firestore falso e requests mockado: nada sai da maquina."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import main
from tests.helpers import CHAVE_FALSA, FakeResposta

TOKEN = "token-de-teste"
# Contrato anterior ao SerpApi. Nao pode perder nenhum destes campos.
CAMPOS_ORIGINAIS = {"id", "titulo", "empresa", "link", "data_coleta", "descricao", "salario"}


@pytest.fixture
def client(fake_db, monkeypatch):
    monkeypatch.setattr(main, "SCRAPER_TOKEN", TOKEN)
    main.app.dependency_overrides[main.get_db] = lambda: fake_db
    main.cache_vagas.limpar()
    yield TestClient(main.app)  # sem "with": nao dispara o lifespan (credencial do Firebase)
    main.app.dependency_overrides.clear()


# --------------------------------------------------------------------------
# GET /api/vagas: o contrato consumido por frontend-react/src/lib/api.js
# --------------------------------------------------------------------------
def test_vagas_mantem_o_formato_anterior_com_fonte_e_via_extras(client, fake_db):
    # documento gravado antes do SerpApi: sem fonte nem via
    fake_db.collection("vagas").document("antiga").set({
        "titulo": "Estágio TI", "empresa": "ACME", "link": "https://acme.test/1",
        "data_coleta": "2026-09-01", "descricao": "d", "salario": "A combinar",
    })
    fake_db.collection("vagas").document("nova").set({
        "titulo": "Estágio Dados", "empresa": "Beta", "link": "https://beta.test/2",
        "data_coleta": "2026-10-09", "descricao": "d2", "salario": "R$ 2 mil por mês",
        "fonte": "serpapi", "via": "Catho", "logo": "data:image/png;base64,AAAA",
    })

    resposta = client.get("/api/vagas")

    assert resposta.status_code == 200
    vagas = {v["id"]: v for v in resposta.json()}
    for v in vagas.values():
        assert set(v) == CAMPOS_ORIGINAIS | {"fonte", "via", "logo"}
    assert vagas["antiga"] == {
        "id": "antiga", "titulo": "Estágio TI", "empresa": "ACME", "link": "https://acme.test/1",
        "data_coleta": "2026-09-01", "descricao": "d", "salario": "A combinar",
        "fonte": "companhia_estagios", "via": "", "logo": "",
    }
    assert (vagas["nova"]["fonte"], vagas["nova"]["via"]) == ("serpapi", "Catho")
    assert vagas["nova"]["logo"] == "data:image/png;base64,AAAA"


def test_vagas_vazio_devolve_lista(client):
    assert client.get("/api/vagas").json() == []


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "colecao": "vagas"}


# --------------------------------------------------------------------------
# POST /api/coleta
# --------------------------------------------------------------------------
def test_coleta_exige_token(client):
    assert client.post("/api/coleta").status_code == 401
    assert client.post("/api/coleta", headers={"X-Scraper-Token": "errado"}).status_code == 401


def test_coleta_roda_serpapi_e_devolve_campos_antigos_mais_serpapi(client, fake_db, resposta_serpapi,
                                                                     serpapi_http, monkeypatch):
    monkeypatch.setenv("SERPAPI_KEY", CHAVE_FALSA)
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    # vaga de outra fonte, ja expirada: a limpeza continua valendo para qualquer fonte
    expirada = datetime.now(timezone.utc) - timedelta(days=1)
    fake_db.collection("vagas").document("velha").set({"titulo": "x", "data_expiracao": expirada})

    resposta = client.post("/api/coleta", headers={"X-Scraper-Token": TOKEN})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert {"vagas_expiradas_removidas", "vagas_novas", "vagas_renovadas", "cards_encontrados"} <= set(corpo)
    assert corpo["vagas_expiradas_removidas"] == 1
    assert corpo["vagas_novas"] == 7 and corpo["cards_encontrados"] == 7
    assert corpo["serpapi"]["erro"] is None
    assert corpo["serpapi"]["resultados_brutos"] > 0
    assert "velha" not in fake_db.docs("vagas")
    # as vagas gravadas saem em GET /api/vagas com fonte e via
    vagas = client.get("/api/vagas").json()
    assert len(vagas) == 7 and {v["fonte"] for v in vagas} == {"serpapi"}


def test_execucao_padrao_usa_16_buscas_8_localidades_x_2_consultas(client, resposta_serpapi, serpapi_http, monkeypatch):
    monkeypatch.setenv("SERPAPI_KEY", CHAVE_FALSA)
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())

    corpo = client.post("/api/coleta", headers={"X-Scraper-Token": TOKEN}).json()

    assert len(serpapi_http.chamadas) == 16
    assert corpo["serpapi"]["buscas_realizadas"] == 16
    assert len({c["location"] for c in serpapi_http.chamadas}) == 8


def test_chave_nunca_aparece_na_resposta(client, resposta_serpapi, serpapi_http, monkeypatch):
    monkeypatch.setenv("SERPAPI_KEY", CHAVE_FALSA)
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())

    resposta = client.post("/api/coleta", headers={"X-Scraper-Token": TOKEN})
    listagem = client.get("/api/vagas")

    assert CHAVE_FALSA not in resposta.text
    assert CHAVE_FALSA not in listagem.text


def test_falha_do_serpapi_nao_derruba_a_coleta_e_informa_o_erro(client, fake_db, serpapi_http, monkeypatch):
    import requests

    monkeypatch.setenv("SERPAPI_KEY", CHAVE_FALSA)
    serpapi_http.responder = lambda params: requests.ConnectionError(f"url ?api_key={CHAVE_FALSA}")
    expirada = datetime.now(timezone.utc) - timedelta(days=1)
    fake_db.collection("vagas").document("velha").set({"titulo": "x", "data_expiracao": expirada})

    resposta = client.post("/api/coleta", headers={"X-Scraper-Token": TOKEN})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["vagas_expiradas_removidas"] == 1  # a parte que nao depende do SerpApi segue
    assert "ConnectionError" in corpo["serpapi"]["erro"]
    assert CHAVE_FALSA not in resposta.text


def test_sem_chave_configurada_informa_no_resultado(client, serpapi_http):
    resposta = client.post("/api/coleta", headers={"X-Scraper-Token": TOKEN})
    assert resposta.status_code == 200
    assert "SERPAPI_KEY" in resposta.json()["serpapi"]["erro"]
    assert serpapi_http.chamadas == []


# --------------------------------------------------------------------------
# CORS
# --------------------------------------------------------------------------
@pytest.mark.parametrize("origem", [
    "http://localhost:5173", "http://127.0.0.1:5173",  # Vite dev
    "http://localhost:4173",                            # Vite preview
    "http://localhost:5500",                            # Live Server
])
def test_cors_libera_as_origens_de_desenvolvimento(client, origem):
    resposta = client.get("/api/vagas", headers={"Origin": origem})
    assert resposta.headers["access-control-allow-origin"] == origem


def test_cors_preflight_do_frontend(client):
    resposta = client.options("/api/vagas", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET",
    })
    assert resposta.status_code == 200
    assert resposta.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_nao_libera_origem_desconhecida(client):
    resposta = client.get("/api/vagas", headers={"Origin": "https://site-malicioso.test"})
    assert "access-control-allow-origin" not in resposta.headers


def test_origens_do_ambiente_sem_curinga_e_sem_barra_final():
    assert main._origens_permitidas(None) == main.ORIGENS_DEV
    assert main._origens_permitidas("  ") == main.ORIGENS_DEV
    assert main._origens_permitidas("https://app.startme.test/, http://localhost:5174") == [
        "https://app.startme.test", "http://localhost:5174",
    ]
    assert main._origens_permitidas("*, https://app.startme.test") == ["https://app.startme.test"]


# --------------------------------------------------------------------------
# Firestore: emulador local x Firebase real
# --------------------------------------------------------------------------
def test_get_db_usa_o_emulador_com_credencial_anonima(monkeypatch):
    from google.auth.credentials import AnonymousCredentials

    criados = []

    class ClienteFalso:
        def __init__(self, **kwargs):
            criados.append(kwargs)

    monkeypatch.setattr(main, "_db", None)
    monkeypatch.setenv("FIRESTORE_EMULATOR_HOST", "firestore:8080")
    monkeypatch.delenv("GOOGLE_CLOUD_PROJECT", raising=False)
    monkeypatch.setattr("google.cloud.firestore.Client", ClienteFalso)
    monkeypatch.setattr(main.firebase_admin, "initialize_app",
                        lambda *a, **k: pytest.fail("nao deve tocar no Firebase real"))

    cliente = main.get_db()

    assert isinstance(cliente, ClienteFalso)
    assert criados[0]["project"] == "startme-local"
    assert isinstance(criados[0]["credentials"], AnonymousCredentials)
    monkeypatch.setattr(main, "_db", None)


def test_get_db_sem_emulador_exige_a_credencial(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "_db", None)
    monkeypatch.delenv("FIRESTORE_EMULATOR_HOST", raising=False)
    monkeypatch.delenv("GOOGLE_CLOUD_PROJECT", raising=False)
    monkeypatch.setattr(main, "CRED_PATH", str(tmp_path / "nao-existe.json"))
    with pytest.raises(RuntimeError, match="Credencial do Firebase nao encontrada"):
        main.get_db()


def test_get_db_sem_arquivo_usa_application_default_credentials(monkeypatch, tmp_path):
    inicializacoes = []
    monkeypatch.setattr(main, "_db", None)
    monkeypatch.delenv("FIRESTORE_EMULATOR_HOST", raising=False)
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "projeto-teste")
    monkeypatch.setattr(main, "CRED_PATH", str(tmp_path / "nao-existe.json"))
    monkeypatch.setattr(main.credentials, "ApplicationDefault", lambda: "adc")
    monkeypatch.setattr(main.firebase_admin, "initialize_app",
                        lambda cred, opcoes=None: inicializacoes.append((cred, opcoes)))
    monkeypatch.setattr(main.firestore, "client", lambda: "cliente")

    assert main.get_db() == "cliente"
    assert inicializacoes == [("adc", {"projectId": "projeto-teste"})]
    monkeypatch.setattr(main, "_db", None)


# --------------------------------------------------------------------------
# Cache de GET /api/vagas (poupa a cota de leituras do Firestore)
# --------------------------------------------------------------------------
def semear(fake_db, n=3):
    for i in range(n):
        fake_db.collection("vagas").document(f"v{i}").set({
            "titulo": f"Estagio {i}", "empresa": "ACME", "link": f"https://acme.test/{i}", "data_coleta": "2026-10-12",
        })


def test_varias_requisicoes_geram_uma_unica_leitura_do_firestore(client, fake_db):
    semear(fake_db, 5)

    estados = [client.get("/api/vagas").headers["X-Cache"] for _ in range(20)]

    assert estados == ["MISS"] + ["HIT"] * 19
    assert fake_db.collection("vagas").leituras == 5  # sem cache seriam 100


def test_cache_expira_apos_o_ttl(client, fake_db, monkeypatch):
    semear(fake_db, 2)
    relogio = {"t": 1000.0}
    monkeypatch.setattr(main.time, "monotonic", lambda: relogio["t"])
    monkeypatch.setattr(main, "VAGAS_CACHE_TTL", 120)

    assert client.get("/api/vagas").headers["X-Cache"] == "MISS"
    relogio["t"] += 119
    assert client.get("/api/vagas").headers["X-Cache"] == "HIT"
    relogio["t"] += 2  # 121 s: venceu
    assert client.get("/api/vagas").headers["X-Cache"] == "MISS"
    assert fake_db.collection("vagas").leituras == 4


def test_ttl_zero_desliga_o_cache(client, fake_db, monkeypatch):
    semear(fake_db, 2)
    monkeypatch.setattr(main, "VAGAS_CACHE_TTL", 0)

    respostas = [client.get("/api/vagas") for _ in range(3)]

    assert [r.headers["X-Cache"] for r in respostas] == ["MISS"] * 3
    assert all("cache-control" not in r.headers for r in respostas)
    assert fake_db.collection("vagas").leituras == 6


def test_resposta_traz_cache_control_curto_para_navegador_e_cdn(client, fake_db):
    resposta = client.get("/api/vagas")
    assert resposta.headers["cache-control"] == "public, max-age=60"  # TTL 120, mas o navegador fica em 60


def test_coleta_invalida_o_cache(client, fake_db, resposta_serpapi, serpapi_http, monkeypatch):
    monkeypatch.setenv("SERPAPI_KEY", CHAVE_FALSA)
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    assert client.get("/api/vagas").json() == []  # vazio, agora em cache
    assert client.get("/api/vagas").headers["X-Cache"] == "HIT"

    client.post("/api/coleta", headers={"X-Scraper-Token": TOKEN})

    depois = client.get("/api/vagas")
    assert depois.headers["X-Cache"] == "MISS"  # a coleta invalidou
    assert len(depois.json()) == 7  # e a lista nova ja aparece


def test_firestore_fora_do_ar_serve_a_copia_vencida(client, fake_db, monkeypatch):
    semear(fake_db, 2)
    assert client.get("/api/vagas").headers["X-Cache"] == "MISS"
    main.cache_vagas.invalidar()  # venceu, mas a copia continua guardada

    def quebrado(_):
        raise RuntimeError("429 Quota exceeded")

    monkeypatch.setattr(main, "_ler_vagas", quebrado)
    resposta = client.get("/api/vagas")

    assert resposta.status_code == 200 and len(resposta.json()) == 2
    assert resposta.headers["X-Cache"] == "STALE"


def test_firestore_fora_do_ar_sem_copia_devolve_erro(fake_db, monkeypatch):
    main.app.dependency_overrides[main.get_db] = lambda: fake_db
    main.cache_vagas.limpar()

    def quebrado(_):
        raise RuntimeError("fora do ar")

    monkeypatch.setattr(main, "_ler_vagas", quebrado)
    try:
        assert TestClient(main.app, raise_server_exceptions=False).get("/api/vagas").status_code == 500
    finally:
        main.app.dependency_overrides.clear()
