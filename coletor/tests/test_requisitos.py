"""Testes de extração de requisitos de vagas."""
import pytest
from requisitos import extrair_requisitos, enriquecer_vaga_com_requisitos


class TestExtrairRequisitos:
    """Testes da extração de skills."""

    def test_extrai_skills_basicos(self):
        """Extrai Python, JavaScript, React."""
        titulo = "Estágio em Python e JavaScript"
        descricao = "Procuramos candidato com React para frontend."
        requisitos = extrair_requisitos(titulo, descricao)

        textos = [r['texto'] for r in requisitos]
        assert 'Python' in textos
        assert 'JavaScript' in textos
        assert 'React' in textos

    def test_extrai_multiplos_skills(self):
        """Extrai vários skills da descrição."""
        titulo = "Dev Junior"
        descricao = """
        Procuramos desenvolvedor com experiência em:
        - Python e Django
        - PostgreSQL e Redis
        - Docker e Linux
        - REST API
        """
        requisitos = extrair_requisitos(titulo, descricao)

        textos = [r['texto'] for r in requisitos]
        assert 'Python' in textos
        assert 'Django' in textos
        assert 'PostgreSQL' in textos
        assert 'Docker' in textos

    def test_sem_duplicatas(self):
        """Não retorna skills duplicados."""
        titulo = "Python Python"
        descricao = "Python e mais Python"
        requisitos = extrair_requisitos(titulo, descricao)

        assert len(requisitos) == 1
        assert requisitos[0]['texto'] == 'Python'

    def test_case_insensitive(self):
        """Detecta skills independente de maiúsculas."""
        titulo = "PYTHON e javascript"
        descricao = "React, FASTAPI"
        requisitos = extrair_requisitos(titulo, descricao)

        textos = [r['texto'] for r in requisitos]
        assert 'Python' in textos
        assert 'JavaScript' in textos
        assert 'React' in textos
        assert 'FastAPI' in textos

    def test_vazio(self):
        """Retorna lista vazia quando sem skills."""
        titulo = "Estagiário"
        descricao = "Procuramos alguém interessado em aprender."
        requisitos = extrair_requisitos(titulo, descricao)

        assert requisitos == []

    def test_estrutura_do_criterio(self):
        """Cada requisito tem tipo, texto e termo."""
        titulo = "Estágio em Python"
        descricao = "Procuramos dev com Python"
        requisitos = extrair_requisitos(titulo, descricao)

        assert len(requisitos) > 0
        r = requisitos[0]
        assert r['tipo'] == 'requisito'
        assert r['texto'] == 'Python'
        assert r['termo'] == 'Python'

    def test_limite(self):
        """Respeita o limite de requisitos retornados."""
        titulo = ""
        descricao = """
        Python Django React Vue Angular Node.js Express
        Firebase MongoDB PostgreSQL AWS Google Cloud Docker
        Kubernetes Git Linux Agile TDD HTML CSS
        """
        requisitos = extrair_requisitos(titulo, descricao, limite=5)

        assert len(requisitos) <= 5

    def test_ordem_alfabetica(self):
        """Retorna skills em ordem alfabética."""
        titulo = "React Python"
        descricao = "Django"
        requisitos = extrair_requisitos(titulo, descricao)

        textos = [r['texto'] for r in requisitos]
        assert textos == sorted(textos)


class TestEnriquecerVaga:
    """Testes de adição de requisitos a uma vaga."""

    def test_adiciona_requisitos_se_faltar(self):
        """Adiciona campo requisitos se não existir."""
        vaga = {
            'titulo': 'Python Developer',
            'descricao': 'Procuramos dev Python com Django',
        }
        resultado = enriquecer_vaga_com_requisitos(vaga)

        assert 'requisitos' in resultado
        assert len(resultado['requisitos']) > 0
        textos = [r['texto'] for r in resultado['requisitos']]
        assert 'Python' in textos
        assert 'Django' in textos

    def test_preserva_requisitos_existentes(self):
        """Não sobrescreve requisitos já presentes."""
        requisitos_originais = [
            {'tipo': 'requisito', 'texto': 'Habilidade Customizada', 'termo': 'Habilidade Customizada'}
        ]
        vaga = {
            'titulo': 'Python Dev',
            'descricao': 'Dev Python',
            'requisitos': requisitos_originais,
        }
        resultado = enriquecer_vaga_com_requisitos(vaga)

        assert resultado['requisitos'] == requisitos_originais

    def test_enriquece_vaga_vazia(self):
        """Enriquece vaga sem requisitos (lista vazia)."""
        vaga = {
            'titulo': 'React',
            'descricao': 'Dev React',
            'requisitos': [],
        }
        resultado = enriquecer_vaga_com_requisitos(vaga)

        assert len(resultado['requisitos']) > 0
        assert resultado['requisitos'][0]['texto'] == 'React'
