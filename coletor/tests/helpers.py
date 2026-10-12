"""Constantes e dublês simples compartilhados pelos testes."""
import copy

CHAVE_FALSA = "chave-de-teste-0123456789abcdef"


class FakeResposta:
    """Dublê de requests.Response, so com o que a fonte usa."""

    def __init__(self, corpo, status_code=200, reason="OK"):
        self._corpo = corpo
        self.status_code = status_code
        self.reason = reason

    def json(self):
        return copy.deepcopy(self._corpo)

    def iter_content(self, chunk_size=4096):
        """Downloads de imagem: `corpo` deve ser bytes."""
        for i in range(0, len(self._corpo), chunk_size):
            yield self._corpo[i : i + chunk_size]
