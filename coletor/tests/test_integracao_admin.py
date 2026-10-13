"""Administração: login com argon2, papéis, trava de custo da coleta, auditoria e isolamento de sessão."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from integracao import cli, sessao
from integracao.admin import criar_admin, normalizar_email, verificar_senha
from integracao.config import Config
from integracao.repositorio import RepositorioMemoria
from integracao.rotas import COOKIE, instalar
from integracao.servicos import ErroIntegracao

SEGREDO = b"s" * 32
PEPPER = b"p" * 32
SENHA = "senha-forte-de-teste-123"
ADMIN = "admin@startme.test"
LEITOR = "leitor@startme.test"


@pytest.fixture
def repo():
    return RepositorioMemoria()


@pytest.fixture
def cliente(repo, fake_db):
    criar_admin(repo, ADMIN, SENHA, "admin")
    criar_admin(repo, LEITOR, SENHA, "leitor")
    chamadas = []

    def coleta(db):
        chamadas.append(db)
        return {"vagas_novas": 3, "vagas_renovadas": 1}

    config = Config(auth_mode="demo", provedor="arquivo", sessao_segredo=SEGREDO, cpf_pepper=PEPPER,
                    ambiente_local=True, serpapi_limite_mensal=240)
    app = FastAPI()
    instalar(app, lambda: fake_db, config, repositorio_de=lambda db: repo, coleta=coleta)
    c = TestClient(app)
    c.coletas = chamadas
    return c


def entrar(c, email, senha=SENHA):
    return c.post("/api/admin/entrar", json={"email": email, "senha": senha})


# --------------------------------------------------------------- senha e login
def test_senha_fica_em_argon2_e_nunca_em_texto(repo):
    criar_admin(repo, ADMIN, SENHA)
    guardado = repo.admin_ler(ADMIN)["senha_hash"]
    assert guardado.startswith("$argon2") and SENHA not in guardado
    assert verificar_senha(guardado, SENHA) and not verificar_senha(guardado, "errada")


def test_senha_curta_e_papel_invalido_sao_recusados(repo):
    with pytest.raises(ValueError):
        criar_admin(repo, ADMIN, "curta")
    with pytest.raises(ValueError):
        criar_admin(repo, ADMIN, SENHA, "superusuario")


def test_email_invalido_nao_chega_ao_banco():
    with pytest.raises(ErroIntegracao):
        normalizar_email("não é e-mail")
    assert normalizar_email("  Admin@StartMe.test ") == "admin@startme.test"


def test_login_admin_e_erro_generico_para_senha_errada_e_e_mail_inexistente(cliente):
    assert entrar(cliente, ADMIN).status_code == 200
    errada = entrar(cliente, ADMIN, senha="x" * 20)
    inexistente = entrar(cliente, "ninguem@startme.test")
    assert errada.status_code == inexistente.status_code == 401
    assert errada.json() == inexistente.json()  # não revela se o e-mail existe


def test_login_admin_nao_serve_como_sessao_de_aluno(cliente):
    entrar(cliente, ADMIN)
    token_admin = cliente.cookies.get(COOKIE)
    cliente.cookies.clear()
    cliente.cookies.set(COOKIE, token_admin)
    assert cliente.get("/api/me").status_code == 401


def test_sessao_de_aluno_nao_acessa_o_painel(cliente):
    cliente.cookies.set(COOKIE, sessao.emitir({"sub": "x", "mascara": "m", "nome": None, "curso": "c",
                                               "semestre": 1, "ativo": True}, SEGREDO, "aluno", 600))
    assert cliente.get("/api/admin/resumo").status_code == 401


# --------------------------------------------------------------- papéis e coleta
def test_leitor_ve_o_resumo_mas_nao_dispara_coleta(cliente):
    entrar(cliente, LEITOR)
    assert cliente.get("/api/admin/resumo").status_code == 200
    r = cliente.post("/api/admin/coleta")
    assert r.status_code == 403 and r.json()["detail"]["codigo"] == "sem_permissao"
    assert cliente.coletas == []


def test_admin_dispara_a_coleta_e_recebe_o_resultado(cliente):
    entrar(cliente, ADMIN)
    r = cliente.post("/api/admin/coleta")
    assert r.status_code == 200 and r.json() == {"vagas_novas": 3, "vagas_renovadas": 1}
    assert len(cliente.coletas) == 1


def test_coleta_manual_respeita_o_intervalo_de_uma_hora(cliente):
    entrar(cliente, ADMIN)
    assert cliente.post("/api/admin/coleta").status_code == 200
    r = cliente.post("/api/admin/coleta")
    assert r.status_code == 429 and r.json()["detail"]["codigo"] == "aguarde_para_coletar"


def test_coleta_nao_roda_sem_cota_suficiente(cliente, repo):
    import time
    repo.cota[time.strftime("%Y-%m", time.gmtime())] = 230  # restam 10 buscas: uma coleta gasta 16
    entrar(cliente, ADMIN)
    r = cliente.post("/api/admin/coleta")
    assert r.status_code == 429 and r.json()["detail"]["codigo"] == "cota_insuficiente"
    assert cliente.coletas == []


def test_bloqueio_de_tentativas_tambem_vale_no_painel(cliente):
    for _ in range(5):
        entrar(cliente, ADMIN, senha="errada-errada-errada")
    assert entrar(cliente, ADMIN).status_code == 429


# --------------------------------------------------------------- auditoria
def test_auditoria_registra_login_e_coleta_sem_dados_de_aluno(cliente):
    entrar(cliente, ADMIN)
    cliente.post("/api/admin/coleta")
    eventos = cliente.get("/api/admin/auditoria").json()
    eventos_nomes = {e["evento"] for e in eventos}
    assert {"admin_login", "coleta_manual"} <= eventos_nomes
    assert all(e["ator"].startswith("admin:") or e["ator"] == "sistema" for e in eventos)
    assert all(set(e) == {"quando", "evento", "ator", "detalhe"} for e in eventos)


def test_resumo_so_traz_contagens_e_a_identidade_do_admin(cliente):
    entrar(cliente, ADMIN)
    corpo = cliente.get("/api/admin/resumo").json()
    assert set(corpo) == {"vagas", "cota", "ultima_coleta", "consentimentos", "email", "papel"}
    assert set(corpo["consentimentos"]) == {"ativos", "total"}
    assert corpo["email"] == ADMIN and corpo["papel"] == "admin"  # identidade do próprio admin, nada de aluno


# --------------------------------------------------------------- CLI
def test_cli_admin_criar_pede_senha_sem_eco_e_grava_so_o_hash(repo, monkeypatch):
    senhas = iter([SENHA, SENHA])
    monkeypatch.setattr("getpass.getpass", lambda *a, **k: next(senhas))
    assert cli.main(["admin-criar", "--email", "novo@startme.test", "--papel", "leitor"],
                    env={"GOOGLE_CLOUD_PROJECT": "x"}, repo=repo) == 0
    registro = repo.admin_ler("novo@startme.test")
    assert registro["papel"] == "leitor" and SENHA not in registro["senha_hash"]


def test_cli_admin_criar_recusa_senhas_diferentes(repo, monkeypatch):
    senhas = iter([SENHA, "outra-senha-diferente"])
    monkeypatch.setattr("getpass.getpass", lambda *a, **k: next(senhas))
    assert cli.main(["admin-criar", "--email", "x@startme.test"], env={"GOOGLE_CLOUD_PROJECT": "x"}, repo=repo) == 1
    assert repo.admin_ler("x@startme.test") is None
