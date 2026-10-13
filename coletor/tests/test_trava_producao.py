"""Trava de entrega: sem MODO_DEMONSTRACAO=true, o serviço só sobe com login institucional e fonte da faculdade."""

import pytest

from integracao.config import Config

SEGREDO = "s" * 32
PEPPER = "p" * 32
BASE = {"SESSAO_SEGREDO": SEGREDO, "CPF_PEPPER": PEPPER}
OIDC = {"AUTH_MODE": "oidc", "ACADEMICO_PROVIDER": "http",
        "ACADEMICO_HTTP_URL": "https://fsa.example/alunos/{cpf}/vinculo",
        "ACADEMICO_HTTP_MAPA": '{"curso":"c","semestre":"s","ativo":"a"}',
        "OIDC_ISSUER": "https://idp.fsa.example", "OIDC_CLIENT_ID": "startme",
        "OIDC_CLIENT_SECRET": "x", "OIDC_REDIRECT_URI": "https://startme.example/api/auth/oidc/retorno"}


def test_sem_variavel_o_padrao_e_producao_e_recusa_a_demonstracao():
    with pytest.raises(ValueError, match="MODO_DEMONSTRACAO=true"):
        Config.do_ambiente({**BASE})


def test_apresentacao_liga_o_modo_demo_e_a_fonte_de_arquivo():
    cfg = Config.do_ambiente({**BASE, "MODO_DEMONSTRACAO": "true"})
    assert cfg.modo_demonstracao and cfg.auth_mode == "demo" and cfg.provedor == "arquivo"


def test_valor_que_nao_e_true_conta_como_producao():
    with pytest.raises(ValueError):
        Config.do_ambiente({**BASE, "MODO_DEMONSTRACAO": "sim"})


def test_entrega_com_login_e_fonte_da_faculdade_sobe():
    cfg = Config.do_ambiente({**BASE, **OIDC})
    assert not cfg.modo_demonstracao and cfg.auth_mode == "oidc" and cfg.provedor == "http"


def test_entrega_recusa_fonte_de_arquivo_mesmo_com_login_institucional():
    with pytest.raises(ValueError, match="alunos fictícios"):
        Config.do_ambiente({**BASE, **OIDC, "ACADEMICO_PROVIDER": "arquivo"})


def test_entrega_recusa_login_demo():
    with pytest.raises(ValueError, match="AUTH_MODE=demo"):
        Config.do_ambiente({**BASE, **OIDC, "AUTH_MODE": "demo"})


def test_publico_mostra_o_modo_para_conferencia():
    cfg = Config.do_ambiente({**BASE, "MODO_DEMONSTRACAO": "true"})
    assert cfg.publico()["modo_demonstracao"] is True
