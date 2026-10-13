"""Contrato dos provedores acadêmicos: a MESMA suíte roda em arquivo, SQL e HTTP.

É a prova do plug-and-play: se os três devolvem o mesmo vínculo para o mesmo aluno, trocar a
fonte da faculdade é trocar variáveis de ambiente.
"""

import json

import pytest
import requests
from sqlalchemy import create_engine, text

from integracao.config import ARQUIVO_PADRAO
from integracao.cpf import digitos
from integracao.provedores.arquivo import ProvedorArquivo
from integracao.provedores.base import AcademicoIndisponivel
from integracao.provedores.http import ProvedorHttp
from integracao.provedores.sql import ProvedorSql, validar_consulta

REGISTROS = json.loads(ARQUIVO_PADRAO.read_text(encoding="utf-8"))
POR_CPF = {digitos(r["cpf"]): r for r in REGISTROS}
ATIVO = digitos("111.444.777-35")
TRANCADO = digitos("123.456.789-09")
INEXISTENTE = "99999999999"
MAPA = {
    "nome": "Aluno.Nome",
    "curso": "Matricula.Curso.Nome",
    "semestre": "Matricula.PeriodoAtual",
    "ativo": {"caminho": "Aluno.Situacao", "em": ["Matriculado"]},
}


# ----------------------------------------------------------- fontes simuladas
def _sql(caminho_banco):
    engine = create_engine(f"sqlite:///{caminho_banco}")
    with engine.begin() as c:
        c.execute(text("CREATE TABLE vw_startme (cpf TEXT, nome TEXT, curso TEXT, semestre INTEGER, situacao TEXT)"))
        for r in REGISTROS:
            c.execute(
                text("INSERT INTO vw_startme VALUES (:cpf, :nome, :curso, :semestre, :situacao)"),
                {"cpf": digitos(r["cpf"]), "nome": r["nome"], "curso": r["curso"],
                 "semestre": r["semestre"], "situacao": "ATIVO" if r["ativo"] else "TRANCADO"},
            )
    engine.dispose()


class _Resposta:
    def __init__(self, status, corpo=None):
        self.status_code = status
        self._corpo = corpo

    def json(self):
        if self._corpo is None:
            raise ValueError("sem corpo")
        return self._corpo


def _resposta_fake(cpf_na_url):
    registro = POR_CPF.get(cpf_na_url)
    if registro is None:
        return _Resposta(404)
    situacao = "Matriculado" if registro["ativo"] else "Trancado"
    return _Resposta(200, {
        "Aluno": {"Nome": registro["nome"], "Situacao": situacao},
        "Matricula": {"Curso": {"Nome": registro["curso"]}, "PeriodoAtual": registro["semestre"]},
    })


def _http_get(url, headers=None, timeout=None):
    return _resposta_fake(url.rsplit("/", 2)[-2])


@pytest.fixture(params=["arquivo", "sql", "http"])
def fonte(request, tmp_path):
    """Devolve (provedor_saudavel, provedor_indisponivel) para cada tipo de fonte."""
    if request.param == "arquivo":
        return ProvedorArquivo(ARQUIVO_PADRAO), None
    if request.param == "sql":
        banco = tmp_path / "faculdade.db"
        _sql(banco)
        consulta = "SELECT nome, curso, semestre, (situacao = 'ATIVO') AS ativo FROM vw_startme WHERE cpf = :cpf"
        ruim = ProvedorSql(f"sqlite:///{tmp_path}/pasta-que-nao-existe/x.db", consulta)
        return ProvedorSql(f"sqlite:///{banco}", consulta), ruim
    url = "https://fsa.example/fsa/alunos/{cpf}/vinculo"
    ruim = ProvedorHttp(url, MAPA, http_get=lambda *a, **k: (_ for _ in ()).throw(requests.ConnectionError("x")))
    return ProvedorHttp(url, MAPA, http_get=_http_get), ruim


# ----------------------------------------------------------- o contrato
def test_aluno_ativo_devolve_o_mesmo_vinculo(fonte):
    bom, _ = fonte
    vinculo = bom.vinculo(ATIVO)
    assert vinculo is not None
    assert vinculo.ativo is True
    assert vinculo.curso == POR_CPF[ATIVO]["curso"]
    assert vinculo.semestre == POR_CPF[ATIVO]["semestre"]
    assert vinculo.nome == POR_CPF[ATIVO]["nome"]


def test_vinculo_trancado_devolve_ativo_falso(fonte):
    bom, _ = fonte
    assert bom.vinculo(TRANCADO).ativo is False


def test_aluno_inexistente_devolve_none(fonte):
    bom, _ = fonte
    assert bom.vinculo(INEXISTENTE) is None


def test_fonte_fora_do_ar_levanta_indisponivel(fonte):
    _, ruim = fonte
    if ruim is None:
        pytest.skip("o arquivo local não fica fora do ar")
    with pytest.raises(AcademicoIndisponivel):
        ruim.vinculo(ATIVO)


def test_nenhuma_resposta_vaza_o_cpf_na_mensagem_de_erro(fonte, caplog):
    _, ruim = fonte
    if ruim is None:
        pytest.skip("o arquivo local não fica fora do ar")
    with caplog.at_level("DEBUG"):
        with pytest.raises(AcademicoIndisponivel) as erro:
            ruim.vinculo(ATIVO)
    assert ATIVO not in str(erro.value) and ATIVO not in caplog.text


# ----------------------------------------------------------- validação e mapa
def test_consulta_so_aceita_select_com_cpf_sem_escrita():
    assert validar_consulta("SELECT nome FROM v WHERE cpf = :cpf;").startswith("SELECT")
    for ruim in ("DELETE FROM v WHERE cpf = :cpf", "SELECT 1 FROM v; DROP TABLE v", "SELECT nome FROM v"):
        with pytest.raises(ValueError):
            validar_consulta(ruim)


def test_mapa_http_exige_campos_e_trata_resposta_fora_do_contrato():
    with pytest.raises(ValueError):
        ProvedorHttp("https://x/{cpf}", {"curso": "a", "semestre": "b"}, http_get=_http_get)
    p = ProvedorHttp("https://x/{cpf}", MAPA, http_get=_http_get)
    with pytest.raises(AcademicoIndisponivel):
        p.mapear({"Aluno": {"Situacao": "Matriculado"}})  # falta o curso
    vinculo = p.mapear({"Aluno": {"Situacao": "Matriculado"}, "Matricula": {"Curso": {"Nome": "X"}, "PeriodoAtual": "5"}})
    assert vinculo.semestre == 5 and vinculo.ativo is True and vinculo.nome is None


def test_url_http_sem_cpf_ou_sem_https_e_recusada():
    with pytest.raises(ValueError):
        ProvedorHttp("https://x/sem-marcador", MAPA)
    with pytest.raises(ValueError):
        ProvedorHttp("http://x/{cpf}", MAPA)
    ProvedorHttp("http://localhost/{cpf}", MAPA, ambiente_local=True)  # só em desenvolvimento
