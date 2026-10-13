"""Sessão do aluno e do administrador: JWT HS256 mínimo, sem dependências extras.

O token carrega só o que a tela precisa (hash do CPF, CPF mascarado, vínculo). Nunca o CPF.
"""

import base64
import hashlib
import hmac
import json
import time


class SessaoInvalida(Exception):
    """Token ausente, adulterado, expirado ou para outro público (aluno x admin)."""


def _b64(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def _des_b64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def emitir(claims: dict, segredo: bytes, aud: str, duracao: int, agora: int | None = None) -> str:
    momento = int(time.time()) if agora is None else agora
    corpo = {**claims, "aud": aud, "iat": momento, "exp": momento + duracao}
    cabecalho = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("ascii"))
    payload = _b64(json.dumps(corpo, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    assinatura = hmac.new(segredo, f"{cabecalho}.{payload}".encode("ascii"), hashlib.sha256).digest()
    return f"{cabecalho}.{payload}.{_b64(assinatura)}"


def verificar(token: str | None, segredo: bytes, aud: str, agora: int | None = None) -> dict:
    if not token or token.count(".") != 2 or not token.isascii():
        raise SessaoInvalida()
    cabecalho, payload, assinatura = token.split(".")
    esperada = hmac.new(segredo, f"{cabecalho}.{payload}".encode("ascii"), hashlib.sha256).digest()
    try:
        if not hmac.compare_digest(esperada, _des_b64(assinatura)):
            raise SessaoInvalida()
        if json.loads(_des_b64(cabecalho)).get("alg") != "HS256":
            raise SessaoInvalida()
        corpo = json.loads(_des_b64(payload).decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as erro:
        raise SessaoInvalida() from erro
    if not isinstance(corpo, dict) or corpo.get("aud") != aud:
        raise SessaoInvalida()
    momento = int(time.time()) if agora is None else agora
    if not isinstance(corpo.get("exp"), int) or corpo["exp"] < momento:
        raise SessaoInvalida()
    return corpo
