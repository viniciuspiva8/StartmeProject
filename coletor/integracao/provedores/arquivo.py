"""Provedor de demonstração: lê um JSON de alunos fictícios. Serve para testes e para o TCC."""

import json
from pathlib import Path

from integracao.contrato import Vinculo
from integracao.cpf import digitos
from integracao.provedores.base import ProvedorAcademico


class ProvedorArquivo(ProvedorAcademico):
    nome = "arquivo"

    def __init__(self, caminho: Path):
        registros = json.loads(Path(caminho).read_text(encoding="utf-8"))
        self._alunos = {digitos(r["cpf"]): r for r in registros}

    def vinculo(self, cpf_digitos: str) -> Vinculo | None:
        registro = self._alunos.get(cpf_digitos)
        if registro is None:
            return None
        return Vinculo(
            ativo=bool(registro["ativo"]),
            curso=registro["curso"],
            semestre=int(registro["semestre"]),
            nome=registro.get("nome"),
        )
