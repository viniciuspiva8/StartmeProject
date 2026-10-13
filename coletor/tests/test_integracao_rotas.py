"""Rotas /api/auth e /api/me: cookie, sem CPF na resposta, IDOR, consentimento, revogação e apagar conta.

Usa um app próprio (não o main), com o Firestore falso do conftest.
"""

import base64
import json
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from integracao import cpf, sessao
from integracao.config import Config
from integracao.rotas import COOKIE, instalar

SEGREDO = b"s" * 32
PEPPER = b"p" * 32
DEMO = "000.000.000-00"
CHAVE_DEMO = cpf.chave("00000000000", PEPPER)


def _config(**extra):
    base = dict(auth_mode="demo", provedor="arquivo", sessao_segredo=SEGREDO, cpf_pepper=PEPPER,
                demo_cpf=DEMO, demo_senha="senha", termo_versao="2026-10", ambiente_local=True)
    base.update(extra)
    return Config(**base)


@pytest.fixture
def montar(fake_db):
    def _montar(config=None):
        app = FastAPI()
        instalar(app, lambda: fake_db, config or _config())
        return TestClient(app)
    return _montar


@pytest.fixture
def cliente(montar):
    return montar()


def entrar(cliente, cpf_=DEMO, senha="senha"):
    return cliente.post("/api/auth/entrar", json={"cpf": cpf_, "senha": senha})


def sessao_de(sub, aud="aluno", mascara="***.000.000-**"):
    return sessao.emitir({"sub": sub, "mascara": mascara, "nome": "X", "curso": "C", "semestre": 1, "ativo": True},
                         SEGREDO, aud, 3600)


# ----------------------------------------------------------------- configuração e subida
def test_publico_config_nao_expoe_segredos(cliente):
    corpo = cliente.get("/api/publico/config").json()
    assert corpo["sessao_ativa"] is True and corpo["modo_auth"] == "demo"
    assert "segredo" not in json.dumps(corpo).lower()


def test_sem_segredo_a_sessao_fica_desligada_com_503(montar):
    cliente = montar(_config(sessao_segredo=None, cpf_pepper=None))
    assert cliente.get("/api/publico/config").json()["sessao_ativa"] is False
    r = entrar(cliente)
    assert r.status_code == 503 and r.json()["detail"]["codigo"] == "sessao_desativada"
    assert cliente.get("/api/me").status_code == 503


def test_modo_nao_implementado_falha_na_subida():
    with pytest.raises(NotImplementedError):
        instalar(FastAPI(), lambda: None, _config(auth_mode="oidc"))


# ----------------------------------------------------------------- login
def test_login_define_cookie_httponly_e_nao_expoe_cpf(cliente):
    r = entrar(cliente)
    assert r.status_code == 200
    cabecalho = r.headers["set-cookie"].lower()
    assert f"{COOKIE}=" in cabecalho and "httponly" in cabecalho and "samesite=lax" in cabecalho
    assert r.headers["cache-control"] == "private, no-store"
    texto = r.text
    assert "000.000.000-00" not in texto and "00000000000" not in texto
    assert r.json()["cpf_mascarado"] == "***.000.000-**"


def test_cookie_em_producao_e_secure(montar):
    r = entrar(montar(_config(ambiente_local=False)))
    assert "secure" in r.headers["set-cookie"].lower()


def test_cpf_nao_aparece_em_log(cliente, caplog):
    with caplog.at_level(logging.DEBUG):
        entrar(cliente)
        entrar(cliente, senha="errada")
    assert "00000000000" not in caplog.text and "000.000.000-00" not in caplog.text


def test_senha_errada_e_cpf_invalido_retornam_codigos_estaveis(cliente):
    r = entrar(cliente, senha="errada")
    assert r.status_code == 401 and r.json()["detail"]["codigo"] == "credenciais_invalidas"
    r = cliente.post("/api/auth/entrar", json={"cpf": "111.111.111-11", "senha": "senha"})
    assert r.status_code == 422 and r.json()["detail"]["codigo"] == "cpf_invalido"


def test_vinculo_trancado_retorna_403(montar):
    cliente = montar(_config(demo_cpf="123.456.789-09", demo_senha="senha"))
    r = cliente.post("/api/auth/entrar", json={"cpf": "123.456.789-09", "senha": "senha"})
    assert r.status_code == 403 and r.json()["detail"]["codigo"] == "vinculo_inativo"


def test_muitas_tentativas_bloqueiam_com_429(cliente):
    for _ in range(5):
        assert entrar(cliente, senha="errada").status_code == 401
    r = entrar(cliente)  # mesmo com a senha certa: o bloqueio vem antes
    assert r.status_code == 429 and r.json()["detail"]["codigo"] == "muitas_tentativas"


def test_sair_remove_o_cookie(cliente):
    entrar(cliente)
    r = cliente.post("/api/auth/sair")
    assert r.status_code == 204
    assert "max-age=0" in r.headers["set-cookie"].lower() or "expires=" in r.headers["set-cookie"].lower()


# ----------------------------------------------------------------- /api/me
def test_me_sem_cookie_e_401(cliente):
    r = cliente.get("/api/me")
    assert r.status_code == 401 and r.json()["detail"]["codigo"] == "nao_autenticado"


def test_token_adulterado_e_token_de_admin_nao_servem(cliente):
    entrar(cliente)
    token = cliente.cookies.get(COOKIE)
    cliente.cookies.set(COOKIE, token[:-2] + ("AA" if not token.endswith("AA") else "BB"))
    assert cliente.get("/api/me").status_code == 401
    cliente.cookies.set(COOKIE, sessao_de(CHAVE_DEMO, aud="admin"))
    assert cliente.get("/api/me").status_code == 401


def test_token_nao_contem_cpf(cliente):
    entrar(cliente)
    payload = cliente.cookies.get(COOKIE).split(".")[1]
    bruto = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)).decode()
    assert "00000000000" not in bruto and "000.000.000-00" not in bruto


def test_me_mostra_vinculo_e_consentimento_sem_cpf(cliente):
    entrar(cliente)
    corpo = cliente.get("/api/me").json()
    assert corpo["vinculo"]["curso"] and corpo["consentimento"]["aceito"] is False
    assert "00000000000" not in json.dumps(corpo)


def test_idor_um_aluno_nao_ve_os_dados_de_outro(montar, fake_db):
    cliente = montar()
    outro = cpf.chave("11144477735", PEPPER)
    fake_db.collection("aluno_consentimentos").document(outro).set({"aceito": True, "versao": "2026-10"})
    cliente.cookies.set(COOKIE, sessao_de(CHAVE_DEMO))
    assert cliente.get("/api/me").json()["consentimento"]["aceito"] is False


# ----------------------------------------------------------------- consentimento e apagar
def test_consentimento_exige_versao_certa_e_aceite_true(cliente):
    entrar(cliente)
    assert cliente.put("/api/me/consentimento", json={"aceito": False, "versao": "2026-10"}).status_code == 422
    r = cliente.put("/api/me/consentimento", json={"aceito": True, "versao": "1999-01"})
    assert r.status_code == 422 and r.json()["detail"]["codigo"] == "versao_termo"
    r = cliente.put("/api/me/consentimento", json={"aceito": True, "versao": "2026-10"})
    assert r.status_code == 200 and r.json()["aceito"] is True
    assert cliente.get("/api/me").json()["consentimento"]["aceito"] is True


def test_revogar_apaga_curriculo_e_marcacoes_mas_guarda_o_registro(cliente, fake_db):
    entrar(cliente)
    cliente.put("/api/me/consentimento", json={"aceito": True, "versao": "2026-10"})
    fake_db.collection("aluno_curriculos").document(CHAVE_DEMO).set({"dados": {"resumo": "x"}})
    fake_db.collection("aluno_marcacoes").document(CHAVE_DEMO).set({"salvas": ["v1"]})
    assert cliente.delete("/api/me/consentimento").status_code == 204
    assert CHAVE_DEMO not in fake_db.docs("aluno_curriculos")
    assert CHAVE_DEMO not in fake_db.docs("aluno_marcacoes")
    registro = fake_db.docs("aluno_consentimentos")[CHAVE_DEMO]
    assert registro["aceito"] is False and registro["revogado_em"]


def test_apagar_conta_remove_tudo_e_o_cookie(cliente, fake_db):
    entrar(cliente)
    cliente.put("/api/me/consentimento", json={"aceito": True, "versao": "2026-10"})
    fake_db.collection("aluno_curriculos").document(CHAVE_DEMO).set({"dados": {}})
    r = cliente.delete("/api/me")
    assert r.status_code == 204
    assert CHAVE_DEMO not in fake_db.docs("aluno_consentimentos")
    assert CHAVE_DEMO not in fake_db.docs("aluno_curriculos")
    assert "max-age=0" in r.headers["set-cookie"].lower() or "expires=" in r.headers["set-cookie"].lower()


def test_auditoria_nunca_guarda_cpf(cliente, fake_db):
    entrar(cliente)
    cliente.put("/api/me/consentimento", json={"aceito": True, "versao": "2026-10"})
    cliente.delete("/api/me")
    eventos = list(fake_db.docs("auditoria").values())
    assert eventos, "a auditoria deveria ter registrado os eventos"
    texto = json.dumps(eventos)
    assert "00000000000" not in texto and "000.000.000-00" not in texto
    assert all(set(e) == {"quando", "evento", "ator", "detalhe"} for e in eventos)
