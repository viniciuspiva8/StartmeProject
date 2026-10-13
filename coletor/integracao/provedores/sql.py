"""Provedor SQL: uma consulta somente leitura, com o CPF como parâmetro.

Serve para qualquer banco que a FSA exponha (uma view é o caminho esperado). A consulta é validada
na subida: precisa ser um único SELECT que use :cpf e não contenha comandos de escrita.
"""

import re

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from integracao.contrato import Vinculo
from integracao.cpf import digitos
from integracao.provedores.base import AcademicoIndisponivel, ProvedorAcademico

_ESCRITA = re.compile(r"(?i)\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|attach|pragma|merge)\b")


def validar_consulta(consulta: str) -> str:
    texto = consulta.strip()
    if texto.endswith(";"):
        texto = texto[:-1].rstrip()
    if ";" in texto:
        raise ValueError("ACADEMICO_SQL_CONSULTA deve ter uma única instrução")
    if not re.match(r"(?is)^select\s", texto):
        raise ValueError("ACADEMICO_SQL_CONSULTA deve começar com SELECT")
    if ":cpf" not in texto:
        raise ValueError("ACADEMICO_SQL_CONSULTA precisa usar o parâmetro :cpf")
    if _ESCRITA.search(texto):
        raise ValueError("ACADEMICO_SQL_CONSULTA contém comando de escrita")
    return texto


def formatar_cpf(cpf_digitos: str) -> str:
    d = digitos(cpf_digitos)
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"


class ProvedorSql(ProvedorAcademico):
    nome = "sql"

    def __init__(self, url: str, consulta: str, cpf_formato: str = "digitos", timeout: float = 5.0):
        self._consulta = text(validar_consulta(consulta))
        self._formato = cpf_formato
        args: dict = {}
        if url.startswith("postgresql"):
            args["connect_timeout"] = max(1, int(timeout))
        if url.startswith("sqlite"):
            args["check_same_thread"] = False  # o FastAPI executa endpoints síncronos em threads
        self._engine = create_engine(url, pool_pre_ping=True, connect_args=args)

    def vinculo(self, cpf_digitos: str) -> Vinculo | None:
        cpf_param = formatar_cpf(cpf_digitos) if self._formato == "pontuado" else cpf_digitos
        try:
            with self._engine.connect() as conexao:
                linha = conexao.execute(self._consulta, {"cpf": cpf_param}).mappings().first()
        except SQLAlchemyError as erro:
            # Sem a mensagem original: ela pode trazer o parâmetro (CPF).
            raise AcademicoIndisponivel("consulta SQL falhou") from erro
        if linha is None:
            return None
        try:
            return Vinculo(
                ativo=bool(linha["ativo"]),
                curso=str(linha["curso"]),
                semestre=int(linha["semestre"]),
                nome=None if linha.get("nome") is None else str(linha["nome"]),
            )
        except (KeyError, TypeError, ValueError) as erro:
            raise AcademicoIndisponivel("resposta SQL fora do contrato") from erro
