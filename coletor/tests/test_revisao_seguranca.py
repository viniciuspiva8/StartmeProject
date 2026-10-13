"""Correções da revisão de segurança: entradas fora do ASCII, corrida no limite, memória, iat e erro 422 sem eco."""

import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from integracao import cpf, oidc, sessao
from integracao.config import Config
from integracao.rotas import instalar
from integracao.seguranca import MAX_CHAVES, LimiteTentativas

SEGREDO = b"s" * 32
PEPPER = b"p" * 32


def test_digitos_arabicos_ou_fullwidth_nao_contam_como_cpf():
    fullwidth = "１１１４４４７７７３５"  # 11144477735 em caracteres de largura total
    assert cpf.digitos(fullwidth) == ""
    with pytest.raises(cpf.CpfInvalido):
        cpf.normalizar(fullwidth)


def test_token_com_caractere_fora_do_ascii_e_sessao_invalida():
    token = sessao.emitir({"sub": "x"}, SEGREDO, "aluno", 600)
    with pytest.raises(sessao.SessaoInvalida):
        sessao.verificar(token + "é", SEGREDO, "aluno")


def test_limite_descarta_chaves_antigas_e_nao_cresce_sem_fim():
    limite = LimiteTentativas(maximo=5, janela=600)
    for i in range(MAX_CHAVES + 500):
        limite.falha(f"chave-{i}", agora=1.0)
    assert len(limite._falhas) <= MAX_CHAVES


def test_limite_resiste_a_requisicoes_simultaneas():
    import threading
    limite = LimiteTentativas(maximo=5, janela=600)
    agora = time.monotonic()
    barreira = threading.Barrier(40)

    def atacar():
        barreira.wait()
        limite.falha("mesma-conta", agora=agora)

    threads = [threading.Thread(target=atacar) for _ in range(40)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert limite.bloqueado("mesma-conta", agora=agora)
    assert len(limite._falhas["mesma-conta"]) == 40


def test_erro_de_validacao_nao_ecoa_cpf_nem_senha():
    config = Config(auth_mode="demo", provedor="arquivo", sessao_segredo=SEGREDO, cpf_pepper=PEPPER,
                    ambiente_local=True)
    app = FastAPI()
    instalar(app, lambda: None, config, repositorio_de=lambda db: None)
    cliente = TestClient(app)
    r = cliente.post("/api/auth/entrar", json={"cpf": "11144477735", "senha": "x" * 300})
    assert r.status_code == 422
    assert r.json() == {"detail": {"codigo": "dados_invalidos"}}
    assert "11144477735" not in r.text and "xxxx" not in r.text


