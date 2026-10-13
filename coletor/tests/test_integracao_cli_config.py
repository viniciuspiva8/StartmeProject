"""Configuração do ambiente e ferramenta `doctor`: falha cedo, sem vazar dados."""

import pytest

from integracao import cli
from integracao.config import Config
from integracao.provedores import construir as construir_provedor

SEGREDO = "s" * 32
PEPPER = "p" * 32


def _env(**extra):
    base = {"SESSAO_SEGREDO": SEGREDO, "CPF_PEPPER": PEPPER}
    base.update(extra)
    return base


def test_padroes_seguros_sem_nenhuma_variavel():
    config = Config.do_ambiente({})
    assert config.auth_mode == "demo" and config.provedor == "arquivo"
    assert config.sessao_ativa is False and config.simulado is True


def test_segredo_curto_e_recusado_na_subida():
    with pytest.raises(ValueError):
        Config.do_ambiente(_env(SESSAO_SEGREDO="curto"))


def test_json_invalido_no_mapa_e_recusado():
    with pytest.raises(ValueError):
        Config.do_ambiente(_env(ACADEMICO_HTTP_MAPA="{nao-e-json"))


def test_provedor_sql_sem_url_falha_na_construcao():
    with pytest.raises(ValueError):
        construir_provedor(Config.do_ambiente(_env(ACADEMICO_PROVIDER="sql")))


def test_autenticacao_http_sem_https_e_recusada():
    from integracao.autenticacao import construir
    config = Config.do_ambiente(_env(AUTH_MODE="http", AUTH_HTTP_URL="http://fsa.example/login"))
    with pytest.raises(ValueError):
        construir(config)


def test_doctor_nao_imprime_cpf_nem_segredo(capsys):
    codigo = cli.main(["doctor", "--cpf", "111.444.777-35"], env=_env())
    saida = capsys.readouterr().out
    assert codigo == 0
    assert "111" not in saida and "444" not in saida and "777" not in saida
    assert SEGREDO not in saida and PEPPER not in saida
    assert "[ok] fonte acadêmica respondeu" in saida
    assert "Vinicius" not in saida and "Aluno Fictício" not in saida  # nome nunca é impresso


def test_doctor_sem_cpf_nao_consulta_ninguem(capsys):
    assert cli.main(["doctor"], env=_env()) == 0
    assert "sem --cpf" in capsys.readouterr().out


def test_doctor_reporta_aluno_trancado_como_falha(capsys):
    assert cli.main(["doctor", "--cpf", "123.456.789-09"], env=_env()) == 1
    assert "vínculo inativo" in capsys.readouterr().out


def test_doctor_com_configuracao_quebrada_falha(capsys):
    assert cli.main(["doctor"], env=_env(ACADEMICO_PROVIDER="sql")) == 1
    assert "ACADEMICO_SQL_URL" in capsys.readouterr().out
