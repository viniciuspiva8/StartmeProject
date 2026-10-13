"""Cria o administrador do e2e no emulador do Firestore (nunca no banco real)."""
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1] / "coletor"
sys.path.insert(0, str(RAIZ))

from google.cloud import firestore  # noqa: E402

from integracao.admin import criar_admin  # noqa: E402
from integracao.repositorio.firestore import RepositorioFirestore  # noqa: E402


def main(email: str, senha: str) -> None:
    db = firestore.Client(project="startme-local")  # o emulador aceita credencial anônima
    criar_admin(RepositorioFirestore(db), email, senha, "admin")
    print(f"administrador de teste criado: {email}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
