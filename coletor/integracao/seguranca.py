"""Limite de tentativas de login, em memória por instância (suficiente para o escopo do TCC)."""

import time


class LimiteTentativas:
    def __init__(self, maximo: int = 5, janela: int = 600):
        self._maximo = maximo
        self._janela = janela
        self._falhas: dict[str, list[float]] = {}

    def _recentes(self, chave: str, agora: float) -> list[float]:
        recentes = [t for t in self._falhas.get(chave, []) if agora - t < self._janela]
        if recentes:
            self._falhas[chave] = recentes
        else:
            self._falhas.pop(chave, None)
        return recentes

    def bloqueado(self, chave: str, agora: float | None = None) -> bool:
        momento = time.monotonic() if agora is None else agora
        return len(self._recentes(chave, momento)) >= self._maximo

    def falha(self, chave: str, agora: float | None = None) -> None:
        momento = time.monotonic() if agora is None else agora
        self._falhas.setdefault(chave, []).append(momento)

    def limpar(self, chave: str) -> None:
        self._falhas.pop(chave, None)
