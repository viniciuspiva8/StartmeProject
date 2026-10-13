"""Currículo e marcações no servidor: versão otimista, limite de tamanho e isolamento entre alunos."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from integracao import cpf, sessao
from integracao.config import Config
from integracao.rotas import COOKIE, instalar

SEGREDO = b"s" * 32
PEPPER = b"p" * 32
DEMO = "000.000.000-00"
CHAVE = cpf.chave("00000000000", PEPPER)
OUTRA = cpf.chave("11144477735", PEPPER)


@pytest.fixture
def cliente(fake_db):
    config = Config(auth_mode="demo", provedor="arquivo", sessao_segredo=SEGREDO, cpf_pepper=PEPPER,
                    demo_cpf=DEMO, demo_senha="senha", ambiente_local=True)
    app = FastAPI()
    instalar(app, lambda: fake_db, config)
    c = TestClient(app)
    c.post("/api/auth/entrar", json={"cpf": DEMO, "senha": "senha"})
    return c


def _token_de(sub):
    return sessao.emitir({"sub": sub, "mascara": "***.000.000-**", "nome": None, "curso": "C",
                          "semestre": 1, "ativo": True}, SEGREDO, "aluno", 3600)


def test_curriculo_novo_comeca_vazio_na_versao_zero(cliente):
    assert cliente.get("/api/me/curriculo").json() == {"dados": {}, "versao": 0}


def test_salvar_incrementa_a_versao_e_le_de_volta(cliente):
    r = cliente.put("/api/me/curriculo", json={"dados": {"resumo": "Estudante de TI"}, "versao": 0})
    assert r.status_code == 200 and r.json()["versao"] == 1
    assert cliente.get("/api/me/curriculo").json() == {"dados": {"resumo": "Estudante de TI"}, "versao": 1}


def test_versao_antiga_e_recusada_com_409_e_a_atual(cliente):
    cliente.put("/api/me/curriculo", json={"dados": {"a": 1}, "versao": 0})
    r = cliente.put("/api/me/curriculo", json={"dados": {"a": 2}, "versao": 0})
    assert r.status_code == 409
    assert r.json()["detail"] == {"codigo": "versao_conflito", "versao_atual": 1}
    assert cliente.get("/api/me/curriculo").json()["dados"] == {"a": 1}  # nada foi sobrescrito


def test_curriculo_acima_de_64_kb_e_recusado(cliente):
    r = cliente.put("/api/me/curriculo", json={"dados": {"texto": "x" * (65 * 1024)}, "versao": 0})
    assert r.status_code == 413 and r.json()["detail"]["codigo"] == "curriculo_grande"


def test_marcacoes_ida_e_volta_e_limite(cliente):
    r = cliente.put("/api/me/marcacoes", json={"salvas": ["v1", "v2"], "aplicadas": ["v1"]})
    assert r.status_code == 200
    assert cliente.get("/api/me/marcacoes").json() == {"salvas": ["v1", "v2"], "aplicadas": ["v1"]}
    muitas = [f"v{i}" for i in range(501)]
    assert cliente.put("/api/me/marcacoes", json={"salvas": muitas, "aplicadas": []}).status_code == 422


def test_um_aluno_nao_le_o_currículo_de_outro(cliente, fake_db):
    fake_db.collection("aluno_curriculos").document(OUTRA).set({"dados": {"segredo": "da outra pessoa"}, "versao": 3})
    assert cliente.get("/api/me/curriculo").json()["dados"] == {}
    cliente.cookies.set(COOKIE, _token_de(OUTRA))
    assert cliente.get("/api/me/curriculo").json()["versao"] == 3


def test_rotas_de_curriculo_sao_privadas_e_exigem_sessao(cliente):
    r = cliente.get("/api/me/curriculo")
    assert r.headers["cache-control"] == "private, no-store"
    cliente.cookies.clear()
    assert cliente.get("/api/me/curriculo").status_code == 401
    assert cliente.put("/api/me/marcacoes", json={"salvas": [], "aplicadas": []}).status_code == 401
