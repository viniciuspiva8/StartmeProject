"""CPF: validação (dígitos verificadores), normalização, máscara e chave pseudônima.

Nunca registre em log o valor de entrada: é dado pessoal.
"""

import hashlib
import hmac
import re


class CpfInvalido(ValueError):
    """CPF com formato ou dígitos verificadores inválidos."""


def digitos(valor: str | None) -> str:
    return re.sub(r"[^0-9]", "", valor or "")  # só ASCII: dígitos de outros alfabetos não contam


def valido(valor: str | None) -> bool:
    d = digitos(valor)
    if len(d) != 11 or d == d[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(d[i]) * (tamanho + 1 - i) for i in range(tamanho))
        dv = (soma * 10) % 11 % 10
        if dv != int(d[tamanho]):
            return False
    return True


def normalizar(valor: str | None, *, excecao_digitos: str | None = None) -> str:
    """Devolve os 11 dígitos. `excecao_digitos` deixa passar um CPF de demonstração sem DV."""
    d = digitos(valor)
    if excecao_digitos and d == excecao_digitos:
        return d
    if not valido(d):
        raise CpfInvalido()
    return d


def mascarar(valor: str | None) -> str:
    """123.456.789-09 -> ***.456.789-**  (o que a tela pode mostrar)."""
    d = digitos(valor)
    return f"***.{d[3:6]}.{d[6:9]}-**"


def chave(cpf_digitos: str, pepper: bytes) -> str:
    """Identificador pseudônimo estável do aluno: HMAC-SHA256 do CPF com o pepper do servidor."""
    return hmac.new(pepper, cpf_digitos.encode("ascii"), hashlib.sha256).hexdigest()
