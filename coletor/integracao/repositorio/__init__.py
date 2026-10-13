"""Persistência da integração: interface, memória (testes) e Firestore (produção)."""

from integracao.repositorio.base import Repositorio
from integracao.repositorio.firestore import RepositorioFirestore
from integracao.repositorio.memoria import RepositorioMemoria

__all__ = ["Repositorio", "RepositorioFirestore", "RepositorioMemoria"]
