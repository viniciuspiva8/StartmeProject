"""API acadêmica FALSA da FSA: o "TOTVS-like" da simulação.

De propósito, o formato da resposta é DIFERENTE do contrato do StartMe (Vinculo). Quem traduz é o
ACADEMICO_HTTP_MAPA do StartMe. Assim a simulação prova o mapeamento, e não só um JSON já pronto.

    GET /fsa/alunos/{cpf}/vinculo        X-API-Key: <FSA_API_KEY>
    200 -> {"Aluno": {...}, "Matricula": {...}}   404 -> sem registro   401 -> chave ausente/errada
"""

import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException

from banco import AlunosSql


def criar_app(alunos, chave_api: str, ao_subir=None) -> FastAPI:
    """`alunos` precisa ter .buscar(cpf_digitos) -> Aluno | None (o teste usa um fake).
    `ao_subir` roda na subida (ex.: aplicar as migrações)."""

    @asynccontextmanager
    async def ciclo(_: FastAPI):
        if ao_subir:
            ao_subir()
        yield

    app = FastAPI(title="FSA (simulada): API acadêmica", version="0.1.0", lifespan=ciclo)

    @app.get("/fsa/alunos/{cpf}/vinculo")
    def vinculo(cpf: str, x_api_key: str | None = Header(default=None)) -> dict:
        if not x_api_key or x_api_key != chave_api:
            raise HTTPException(401, detail="chave de API ausente ou inválida")
        digitos = re.sub(r"\D", "", cpf)
        if len(digitos) != 11:
            raise HTTPException(404, detail="registro não encontrado")
        aluno = alunos.buscar(digitos)
        if aluno is None:
            raise HTTPException(404, detail="registro não encontrado")
        return {
            "Aluno": {
                "Nome": aluno.nome,
                "Situacao": "Matriculado" if aluno.situacao == "ATIVO" else "Trancado",
            },
            "Matricula": {"Curso": {"Nome": aluno.curso}, "PeriodoAtual": aluno.semestre},
        }

    return app


def _app_padrao() -> FastAPI:
    url = os.environ.get("DATABASE_URL", "postgresql+psycopg://fsa:fsa@localhost:5433/faculdade_sim")
    alunos = AlunosSql(url)
    pasta = Path(os.environ.get("MIGRATIONS_DIR", "/migrations"))

    def migrar() -> None:
        if pasta.exists():
            alunos.migrar(pasta)

    return criar_app(alunos, os.environ.get("FSA_API_KEY", "chave-de-teste-fsa"), ao_subir=migrar)


app = _app_padrao()
