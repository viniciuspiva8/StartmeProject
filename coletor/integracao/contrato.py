"""Contrato interno com a faculdade. É tudo o que o StartMe recebe sobre o aluno."""

from pydantic import BaseModel, Field


class Vinculo(BaseModel):
    ativo: bool
    curso: str = Field(min_length=1, max_length=120)
    semestre: int = Field(ge=1, le=20)
    nome: str | None = Field(default=None, max_length=120)
