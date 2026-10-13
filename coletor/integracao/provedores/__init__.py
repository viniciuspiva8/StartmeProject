"""Provedores acadêmicos: de onde vêm vínculo, curso e semestre do aluno."""

from integracao.config import Config
from integracao.provedores.arquivo import ProvedorArquivo
from integracao.provedores.base import AcademicoIndisponivel, ProvedorAcademico


def construir(config: Config) -> ProvedorAcademico:
    if config.provedor == "arquivo":
        return ProvedorArquivo(config.arquivo_alunos)
    # sql e http entram na Fase 3 do plano
    raise NotImplementedError(f"provedor {config.provedor!r} ainda não implementado")


__all__ = ["AcademicoIndisponivel", "ProvedorAcademico", "construir"]
