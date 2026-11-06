"""Extração de requisitos (requisitos.py): formato do front, vocabulário da grade e zonas da descrição."""
import re
from pathlib import Path

import pytest

from requisitos import _VOCABULARIO, LIMITE_POR_LISTA, extrair_requisitos

VAZIO = {"obrigatorios": [], "desejaveis": []}


def obrigatorios(titulo, descricao=""):
    return extrair_requisitos(titulo, descricao)["obrigatorios"]


def test_formato_consumido_pelo_match_do_front():
    assert extrair_requisitos("Estágio em Python", "Requisitos: SQL. Diferenciais: Docker.") == {
        "obrigatorios": ["Python", "SQL"], "desejaveis": ["Docker"],
    }


def test_nomes_canonicos_sao_os_da_grade():
    texto = "Conhecimento em REST, POO, Scrum, testes unitários, lógica de programação e banco de dados."
    assert obrigatorios("", texto) == [
        "APIs REST", "Orientação a objetos", "Metodologias ágeis", "Testes",
        "Lógica de programação", "Banco de dados relacional",
    ]


def test_toda_habilidade_da_grade_do_front_e_conhecida():
    # O match do front compara termo a termo: um nome diferente do da grade nunca casaria.
    grade = Path(__file__).resolve().parents[2] / "frontend-react" / "src" / "data" / "grade.js"
    if not grade.exists():
        pytest.skip("frontend-react fora deste checkout")
    habilidades = set()
    for lista in re.findall(r"habilidades:\s*\[([^\]]*)\]", grade.read_text(encoding="utf-8")):
        habilidades.update(re.findall(r"'([^']+)'", lista))
    conhecidos = {termo for termo, _ in _VOCABULARIO}
    assert habilidades and habilidades <= conhecidos, sorted(habilidades - conhecidos)


@pytest.mark.parametrize("texto, esperado", [
    ("backend em C#/.NET e/ou Node.js + TypeScript", {"C#", ".NET", "Node.js", "TypeScript"}),
    ("Experiência com C/C++ e ASP.NET Core", {"C", "C++", ".NET"}),
    ("React Native e React.js", {"React Native", "React"}),
    ("Esteira de CI/CD com GitHub Actions", {"CI/CD", "Git"}),
])
def test_termos_com_simbolos(texto, esperado):
    assert esperado <= set(obrigatorios("", texto))


def test_vagas_de_suporte_e_redes():
    texto = "Atendimento e suporte a usuários. Suporte a rede WAN e LAN, impressoras e periféricos."
    assert {"Suporte técnico", "Redes", "Hardware"} <= set(obrigatorios("", texto))
    assert obrigatorios("Analista de Redes Junior") == ["Redes"]


def test_sem_falso_positivo_em_texto_comum():
    texto = ("Excelente ambiente, uma das maiores redes de varejo do país, perto do restaurante. Processo "
             "seletivo com testes online e dinâmica. Perfil ágil: vamos juntos! Como você pode crescer aqui.")
    assert extrair_requisitos("Estágio administrativo", texto) == VAZIO


def test_diferenciais_viram_desejaveis():
    assert extrair_requisitos("Estágio", "Requisitos: Python e SQL. Diferenciais: Docker e Git.") == {
        "obrigatorios": ["Python", "SQL"], "desejaveis": ["Docker", "Git"],
    }


def test_termo_nas_duas_zonas_fica_so_em_obrigatorios():
    assert extrair_requisitos("", "Python e SQL. Desejável: Python avançado e Docker.") == {
        "obrigatorios": ["Python", "SQL"], "desejaveis": ["Docker"],
    }


def test_nao_obrigatorio_e_desejavel_e_novo_requisitos_volta_a_obrigatorio():
    assert extrair_requisitos("", "Diferenciais: Docker. Não é obrigatório: Git. Requisitos: Java.") == {
        "obrigatorios": ["Java"], "desejaveis": ["Docker", "Git"],
    }


def test_titulo_conta_como_obrigatorio_e_vem_primeiro():
    assert extrair_requisitos("Estágio em Python", "Desejável: Python e SQL.") == {
        "obrigatorios": ["Python"], "desejaveis": ["SQL"],
    }


def test_ordem_de_aparicao_sem_repeticao():
    assert obrigatorios("", "SQL, Python, Git e de novo SQL e Python.") == ["SQL", "Python", "Git"]


def test_texto_vazio_ou_ausente():
    assert extrair_requisitos("", "") == VAZIO
    assert extrair_requisitos(None, None) == VAZIO


def test_limite_por_lista():
    todos = " ".join(termo for termo, _ in _VOCABULARIO)
    assert len(obrigatorios("", todos)) == LIMITE_POR_LISTA
