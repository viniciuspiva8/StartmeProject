"""Provedor de arquivo e repositório Firestore (com o Firestore falso do conftest)."""

from integracao.config import ARQUIVO_PADRAO
from integracao.cpf import digitos
from integracao.provedores.arquivo import ProvedorArquivo
from integracao.repositorio import RepositorioFirestore


def test_provedor_arquivo_devolve_vinculo_e_trata_inexistente_e_trancado():
    p = ProvedorArquivo(ARQUIVO_PADRAO)
    vinculo = p.vinculo(digitos("111.444.777-35"))
    assert vinculo.ativo is True and vinculo.semestre == 7 and vinculo.curso
    assert p.vinculo(digitos("123.456.789-09")).ativo is False
    assert p.vinculo("99999999999") is None


def test_repositorio_firestore_consentimento_ida_e_volta(fake_db):
    repo = RepositorioFirestore(fake_db)
    assert repo.consentimento_ler("h1") is None
    repo.consentimento_gravar("h1", {"aceito": True, "versao": "2026-10"})
    assert repo.consentimento_ler("h1") == {"aceito": True, "versao": "2026-10"}


def test_dados_apagar_respeita_a_flag_do_consentimento(fake_db):
    repo = RepositorioFirestore(fake_db)
    repo.consentimento_gravar("h1", {"aceito": True})
    fake_db.collection("aluno_curriculos").document("h1").set({"x": 1})
    repo.dados_apagar("h1", incluir_consentimento=False)
    assert "h1" not in fake_db.docs("aluno_curriculos")
    assert "h1" in fake_db.docs("aluno_consentimentos")
    repo.dados_apagar("h1", incluir_consentimento=True)
    assert "h1" not in fake_db.docs("aluno_consentimentos")


def test_auditoria_lista_do_mais_recente_e_respeita_o_limite(fake_db):
    repo = RepositorioFirestore(fake_db)
    for i in range(5):
        repo.auditoria_registrar({"quando": f"2026-10-0{i + 1}T00:00:00+00:00", "evento": f"e{i}", "ator": "sistema", "detalhe": ""})
    recentes = repo.auditoria_listar(2)
    assert [e["evento"] for e in recentes] == ["e4", "e3"]
