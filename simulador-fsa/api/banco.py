"""Acesso ao banco simulado da FSA e migrações versionadas.

A API falsa usa a mesma view (`vw_startme`) que o provedor SQL do StartMe lê. Migrações são
aplicadas em ordem, uma vez cada, e registradas em `schema_migrations`.
"""

from pathlib import Path
from typing import NamedTuple

from sqlalchemy import create_engine, text


class Aluno(NamedTuple):
    nome: str
    curso: str
    semestre: int
    situacao: str  # ATIVO | TRANCADO


class AlunosSql:
    def __init__(self, url: str):
        self._engine = create_engine(url, pool_pre_ping=True)

    def buscar(self, cpf_digitos: str) -> Aluno | None:
        with self._engine.connect() as conexao:
            linha = conexao.execute(
                text("SELECT nome, curso, semestre, situacao FROM vw_startme WHERE cpf = :cpf"),
                {"cpf": cpf_digitos},
            ).mappings().first()
        if linha is None:
            return None
        return Aluno(linha["nome"], linha["curso"], int(linha["semestre"]), linha["situacao"])

    def migrar(self, pasta: Path) -> list[str]:
        """Aplica as migrações pendentes (arquivos *.sql em ordem). Devolve as aplicadas agora."""
        aplicadas: list[str] = []
        with self._engine.begin() as conexao:
            conexao.execute(text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                " versao TEXT PRIMARY KEY, aplicado_em TIMESTAMPTZ NOT NULL DEFAULT now())"
            ))
            ja = {linha[0] for linha in conexao.execute(text("SELECT versao FROM schema_migrations"))}
            for arquivo in sorted(Path(pasta).glob("*.sql")):
                if arquivo.name in ja:
                    continue
                conexao.exec_driver_sql(arquivo.read_text(encoding="utf-8"))
                conexao.execute(text("INSERT INTO schema_migrations (versao) VALUES (:v)"), {"v": arquivo.name})
                aplicadas.append(arquivo.name)
        return aplicadas

    def fechar(self) -> None:
        self._engine.dispose()
