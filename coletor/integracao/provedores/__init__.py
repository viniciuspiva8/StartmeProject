"""Provedores acadêmicos: de onde vêm vínculo, curso e semestre do aluno."""

from integracao.config import Config
from integracao.provedores.arquivo import ProvedorArquivo
from integracao.provedores.base import AcademicoIndisponivel, ProvedorAcademico
from integracao.provedores.http import ProvedorHttp
from integracao.provedores.sql import ProvedorSql


def construir(config: Config) -> ProvedorAcademico:
    """Monta o provedor configurado. Configuração incompleta falha na subida, não na primeira consulta."""
    if config.provedor == "arquivo":
        return ProvedorArquivo(config.arquivo_alunos)
    if config.provedor == "sql":
        if not config.sql_url:
            raise ValueError("ACADEMICO_SQL_URL é obrigatória com ACADEMICO_PROVIDER=sql")
        return ProvedorSql(config.sql_url, config.sql_consulta, config.cpf_formato, config.timeout)
    if config.provedor == "http":
        if not config.http_url:
            raise ValueError("ACADEMICO_HTTP_URL é obrigatória com ACADEMICO_PROVIDER=http")
        return ProvedorHttp(
            config.http_url,
            config.http_mapa,
            config.http_cabecalhos,
            config.cpf_formato,
            config.timeout,
            ambiente_local=config.ambiente_local,
        )
    raise ValueError(f"provedor desconhecido: {config.provedor!r}")


__all__ = ["AcademicoIndisponivel", "ProvedorAcademico", "ProvedorArquivo", "ProvedorHttp", "ProvedorSql", "construir"]
