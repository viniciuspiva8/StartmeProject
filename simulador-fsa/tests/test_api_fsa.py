"""API acadêmica falsa: formato próprio, chave de API e 404 para CPF desconhecido."""

import pytest
from fastapi.testclient import TestClient

from conftest import modulo_api
from banco import Aluno

api = modulo_api()


class AlunosFake:
    DADOS = {
        "11144477735": Aluno("Aluno Fictício 1", "Engenharia de Computação", 7, "ATIVO"),
        "12345678909": Aluno("Aluno Fictício 3", "Engenharia de Computação", 4, "TRANCADO"),
    }

    def buscar(self, cpf_digitos):
        return self.DADOS.get(cpf_digitos)


@pytest.fixture
def cliente():
    return TestClient(api.criar_app(AlunosFake(), "chave-teste"))


CABECALHO = {"X-API-Key": "chave-teste"}


def test_formato_proprio_da_fsa(cliente):
    r = cliente.get("/fsa/alunos/111.444.777-35/vinculo", headers=CABECALHO)
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["Aluno"]["Situacao"] == "Matriculado"
    assert corpo["Matricula"]["Curso"]["Nome"] == "Engenharia de Computação"
    assert corpo["Matricula"]["PeriodoAtual"] == 7
    assert "ativo" not in corpo  # o contrato do StartMe é outro: quem traduz é o mapa


def test_trancado_aparece_como_trancado(cliente):
    assert cliente.get("/fsa/alunos/12345678909/vinculo", headers=CABECALHO).json()["Aluno"]["Situacao"] == "Trancado"


def test_chave_ausente_ou_errada_e_401(cliente):
    assert cliente.get("/fsa/alunos/11144477735/vinculo").status_code == 401
    assert cliente.get("/fsa/alunos/11144477735/vinculo", headers={"X-API-Key": "outra"}).status_code == 401


def test_cpf_desconhecido_ou_malformado_e_404(cliente):
    assert cliente.get("/fsa/alunos/99999999999/vinculo", headers=CABECALHO).status_code == 404
    assert cliente.get("/fsa/alunos/123/vinculo", headers=CABECALHO).status_code == 404
