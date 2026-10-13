"""Limite de tentativas de login, em memória por instância (suficiente para o escopo do TCC)."""

import threading
import time

MAX_CHAVES = 10_000  # teto de memória: chaves antigas são descartadas antes de crescer sem limite


class LimiteTentativas:
    def __init__(self, maximo: int = 5, janela: int = 600):
        self._maximo = maximo
        self._janela = janela
        self._falhas: dict[str, list[float]] = {}
        self._trava = threading.Lock()  # checagem e registro na mesma seção: sem corrida entre requisições

    def _limpar_antigas(self, agora: float) -> None:
        if len(self._falhas) <= MAX_CHAVES:
            return
        for chave in list(self._falhas):
            self._recentes(chave, agora)
        while len(self._falhas) > MAX_CHAVES:
            self._falhas.pop(next(iter(self._falhas)))

    def _recentes(self, chave: str, agora: float) -> list[float]:
        recentes = [t for t in self._falhas.get(chave, []) if agora - t < self._janela]
        if recentes:
            self._falhas[chave] = recentes
        else:
            self._falhas.pop(chave, None)
        return recentes

    def bloqueado(self, chave: str, agora: float | None = None) -> bool:
        momento = time.monotonic() if agora is None else agora
        with self._trava:
            return len(self._recentes(chave, momento)) >= self._maximo

    def falha(self, chave: str, agora: float | None = None) -> None:
        momento = time.monotonic() if agora is None else agora
        with self._trava:
            self._falhas.setdefault(chave, []).append(momento)
            self._limpar_antigas(momento)

    def limpar(self, chave: str) -> None:
        with self._trava:
            self._falhas.pop(chave, None)
