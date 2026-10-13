"""IdP FALSO da FSA: OpenID Connect mínimo para a simulação (code + PKCE, RS256).

Não é um provedor de produção. Mostra o contrato que a FSA precisaria oferecer:
discovery, autorização, troca do código, assinatura RS256 e JWKS, com o CPF num claim.

Contas de teste (todas com senha "senha"): ver CONTAS_TESTE. Não exponha este serviço na internet.
"""

import base64
import hashlib
import hmac
import html
import json
import os
import secrets
import time
from urllib.parse import urlencode

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import FastAPI, Form, Query
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

ISSUER = os.environ.get("IDP_ISSUER", "http://localhost:8102")
CLIENT_ID = os.environ.get("IDP_CLIENT_ID", "startme")
CLIENT_SECRET = os.environ.get("IDP_CLIENT_SECRET", "segredo-de-teste-do-startme")
REDIRECT_URIS = set(filter(None, os.environ.get(
    "IDP_REDIRECT_URIS", "http://localhost:8080/api/auth/oidc/retorno").split(",")))
CLAIM_CPF = os.environ.get("IDP_CPF_CLAIM", "cpf")
SENHA_TESTE = "senha"
CONTAS_TESTE = {"00000000000", "11144477735", "52998224725", "12345678909"}  # digits; ver seed 0002
VIDA_CODIGO = 60
VIDA_ID_TOKEN = 300

_chave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_KID = hashlib.sha256(_chave.public_key().public_bytes(
    serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)).hexdigest()[:16]
_codigos: dict[str, dict] = {}


def _b64(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def _int_b64(n: int) -> str:
    return _b64(n.to_bytes((n.bit_length() + 7) // 8, "big"))


def assinar_jwt(claims: dict) -> str:
    cabecalho = _b64(json.dumps({"alg": "RS256", "typ": "JWT", "kid": _KID}, separators=(",", ":")).encode())
    corpo = _b64(json.dumps(claims, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    assinatura = _chave.sign(f"{cabecalho}.{corpo}".encode("ascii"), padding.PKCS1v15(), hashes.SHA256())
    return f"{cabecalho}.{corpo}.{_b64(assinatura)}"


def _pkce_s256(verificador: str) -> str:
    return _b64(hashlib.sha256(verificador.encode("ascii")).digest())


def criar_app() -> FastAPI:
    app = FastAPI(title="FSA (simulada): IdP OIDC", version="0.1.0")

    @app.get("/.well-known/openid-configuration")
    def descoberta() -> dict:
        return {
            "issuer": ISSUER,
            "authorization_endpoint": f"{ISSUER}/authorize",
            "token_endpoint": f"{ISSUER}/token",
            "jwks_uri": f"{ISSUER}/jwks.json",
            "response_types_supported": ["code"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"],
            "code_challenge_methods_supported": ["S256"],
            "claims_supported": ["sub", "iss", "aud", "exp", "iat", "nonce", CLAIM_CPF],
        }

    @app.get("/jwks.json")
    def jwks() -> dict:
        numeros = _chave.public_key().public_numbers()
        return {"keys": [{"kty": "RSA", "kid": _KID, "alg": "RS256", "use": "sig",
                          "n": _int_b64(numeros.n), "e": _int_b64(numeros.e)}]}

    @app.get("/authorize", response_class=HTMLResponse)
    def autorizar(
        client_id: str = Query(...), redirect_uri: str = Query(...), response_type: str = Query(...),
        state: str = Query(...), nonce: str = Query(...), code_challenge: str = Query(...),
        code_challenge_method: str = Query(...),
    ):
        if client_id != CLIENT_ID or redirect_uri not in REDIRECT_URIS:
            return HTMLResponse("cliente ou redirect_uri não autorizados", status_code=400)
        if response_type != "code" or code_challenge_method != "S256":
            return HTMLResponse("só code com PKCE S256", status_code=400)
        campos = {"client_id": client_id, "redirect_uri": redirect_uri, "state": state,
                  "nonce": nonce, "code_challenge": code_challenge}
        escondidos = "".join(f'<input type="hidden" name="{k}" value="{html.escape(v, quote=True)}">'
                             for k, v in campos.items())
        return HTMLResponse(
            "<!doctype html><meta charset=utf-8><title>Login FSA (simulado)</title>"
            "<h1>Login FSA (simulado)</h1><p>Ambiente de teste. Não use dados reais.</p>"
            f'<form method="post" action="/authorize/confirmar">{escondidos}'
            '<label>CPF <input name="cpf" inputmode="numeric"></label> '
            '<label>Senha <input name="senha" type="password"></label> '
            '<button type="submit">Entrar</button></form>'
        )

    @app.post("/authorize/confirmar")
    def confirmar(
        cpf: str = Form(...), senha: str = Form(...), client_id: str = Form(...),
        redirect_uri: str = Form(...), state: str = Form(...), nonce: str = Form(...),
        code_challenge: str = Form(...),
    ):
        digitos = "".join(c for c in cpf if c.isdigit())
        if client_id != CLIENT_ID or redirect_uri not in REDIRECT_URIS:
            return HTMLResponse("cliente ou redirect_uri não autorizados", status_code=400)
        if digitos not in CONTAS_TESTE or not hmac.compare_digest(senha.encode(), SENHA_TESTE.encode()):
            return HTMLResponse("CPF ou senha não conferem (conta de teste)", status_code=401)
        codigo = secrets.token_urlsafe(32)
        _codigos[codigo] = {"cpf": digitos, "nonce": nonce, "challenge": code_challenge,
                            "redirect_uri": redirect_uri, "client_id": client_id,
                            "exp": time.time() + VIDA_CODIGO}
        return RedirectResponse(f"{redirect_uri}?{urlencode({'code': codigo, 'state': state})}", status_code=302)

    @app.post("/token")
    def token(
        grant_type: str = Form(...), code: str = Form(...), redirect_uri: str = Form(...),
        client_id: str = Form(...), client_secret: str = Form(...), code_verifier: str = Form(...),
    ):
        registro = _codigos.pop(code, None)  # uso único
        erro = None
        if grant_type != "authorization_code":
            erro = "unsupported_grant_type"
        elif registro is None or registro["exp"] < time.time():
            erro = "invalid_grant"
        elif registro["redirect_uri"] != redirect_uri or registro["client_id"] != client_id:
            erro = "invalid_grant"
        elif not hmac.compare_digest(client_secret.encode(), CLIENT_SECRET.encode()):
            erro = "invalid_client"
        elif not hmac.compare_digest(_pkce_s256(code_verifier).encode(), registro["challenge"].encode()):
            erro = "invalid_grant"
        if erro:
            return JSONResponse({"error": erro}, status_code=400)
        agora = int(time.time())
        sub = "aluno-" + hashlib.sha256(registro["cpf"].encode()).hexdigest()[:16]
        id_token = assinar_jwt({
            "iss": ISSUER, "sub": sub, "aud": client_id, "iat": agora,
            "exp": agora + VIDA_ID_TOKEN, "nonce": registro["nonce"], CLAIM_CPF: registro["cpf"],
        })
        return {"access_token": secrets.token_urlsafe(24), "token_type": "Bearer",
                "expires_in": VIDA_ID_TOKEN, "id_token": id_token}

    return app


app = criar_app()
