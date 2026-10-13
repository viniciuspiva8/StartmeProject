"""CPF (validação, máscara, chave pseudônima) e sessão (JWT mínimo)."""

import base64
import json

import pytest

from integracao import cpf, sessao

SEGREDO = b"s" * 32
PEPPER = b"p" * 32


# ----------------------------------------------------------------- CPF
def test_cpf_com_digitos_verificadores_validos_passa():
    assert cpf.valido("111.444.777-35")
    assert cpf.valido("52998224725")


def test_cpf_com_dv_errado_ou_repetido_ou_tamanho_errado_e_recusado():
    assert not cpf.valido("111.444.777-36")
    assert not cpf.valido("111.111.111-11")
    assert not cpf.valido("1234")
    assert not cpf.valido(None)


def test_normalizar_devolve_so_digitos_e_recusa_invalido():
    assert cpf.normalizar("111.444.777-35") == "11144477735"
    with pytest.raises(cpf.CpfInvalido):
        cpf.normalizar("111.444.777-36")


def test_excecao_de_demonstracao_passa_sem_dv_mas_nao_outro_cpf():
    assert cpf.normalizar("000.000.000-00", excecao_digitos="00000000000") == "00000000000"
    with pytest.raises(cpf.CpfInvalido):
        cpf.normalizar("000.000.000-01", excecao_digitos="00000000000")


def test_mascara_nunca_mostra_o_cpf_inteiro():
    assert cpf.mascarar("123.456.789-09") == "***.456.789-**"
    assert "123" not in cpf.mascarar("123.456.789-09")[:4]


def test_chave_e_estavel_depende_do_pepper_e_nao_contem_o_cpf():
    chave = cpf.chave("11144477735", PEPPER)
    assert chave == cpf.chave("11144477735", PEPPER)
    assert chave != cpf.chave("11144477735", b"q" * 32)
    assert "11144477735" not in chave
    assert len(chave) == 64


# ----------------------------------------------------------------- sessão
def test_token_ida_e_volta_com_as_claims():
    token = sessao.emitir({"sub": "abc"}, SEGREDO, "aluno", 60, agora=1000)
    corpo = sessao.verificar(token, SEGREDO, "aluno", agora=1001)
    assert corpo["sub"] == "abc" and corpo["aud"] == "aluno" and corpo["exp"] == 1060


def test_token_de_outro_publico_e_recusado():
    token = sessao.emitir({"sub": "x"}, SEGREDO, "admin", 60, agora=1000)
    with pytest.raises(sessao.SessaoInvalida):
        sessao.verificar(token, SEGREDO, "aluno", agora=1001)


def test_token_expirado_e_recusado():
    token = sessao.emitir({"sub": "x"}, SEGREDO, "aluno", 60, agora=1000)
    with pytest.raises(sessao.SessaoInvalida):
        sessao.verificar(token, SEGREDO, "aluno", agora=2000)


def test_token_adulterado_e_recusado():
    token = sessao.emitir({"sub": "x"}, SEGREDO, "aluno", 60, agora=1000)
    cabecalho, payload, assinatura = token.split(".")
    trocado = base64.urlsafe_b64encode(json.dumps({"sub": "outro", "aud": "aluno", "exp": 9999999999}).encode()).rstrip(b"=").decode()
    for falso in (f"{cabecalho}.{trocado}.{assinatura}", f"{cabecalho}.{payload}.AAAA"):
        with pytest.raises(sessao.SessaoInvalida):
            sessao.verificar(falso, SEGREDO, "aluno", agora=1001)


def test_algoritmo_none_e_recusado():
    b64 = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()  # noqa: E731
    token = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': 'x', 'aud': 'aluno', 'exp': 9999999999})}."
    with pytest.raises(sessao.SessaoInvalida):
        sessao.verificar(token, SEGREDO, "aluno", agora=1)


@pytest.mark.parametrize("lixo", [None, "", "a.b", "nao-e-token", "a.b.c.d"])
def test_lixo_vira_sessao_invalida(lixo):
    with pytest.raises(sessao.SessaoInvalida):
        sessao.verificar(lixo, SEGREDO, "aluno", agora=1)
