"""Carrega os módulos do simulador pelo caminho do arquivo (api/app.py e idp/app.py têm o mesmo nome)."""

import importlib.util
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "api"))  # `from banco import ...` antes de qualquer carregamento


def carregar(nome: str, arquivo: Path):
    if str(arquivo.parent) not in sys.path:
        sys.path.insert(0, str(arquivo.parent))  # `from banco import ...` dentro de api/
    spec = importlib.util.spec_from_file_location(nome, arquivo)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def modulo_api():
    return carregar("simulador_api", RAIZ / "api" / "app.py")


def modulo_idp():
    return carregar("simulador_idp", RAIZ / "idp" / "app.py")
