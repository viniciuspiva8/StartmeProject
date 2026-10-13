"""IdP OIDC falso: discovery, PKCE, código de uso único e assinatura RS256 verificável pelo JWKS."""

import base64
import hashlib
import json
import secrets

import pytest
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi.testclient import TestClient

from conftest import modulo_idp

idp = modulo_idp()
REDIRECT = "http://localhost:8080/api/auth/oidc/retorno"


def _b64(d):
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()


def _unb64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


@pytest.fixture
def cliente():
    return TestClient(idp.criar_app(), follow_redirects=False)


def _par_pkce():
    verificador = secrets.token_urlsafe(48)
    return verificador, _b64(hashlib.sha256(verificador.encode()).digest())


def _autorizar(cliente, challenge, cpf="11144477735", senha="senha"):
    r = cliente.post("/authorize/confirmar", data={
        "cpf": cpf, "senha": senha, "client_id": idp.CLIENT_ID, "redirect_uri": REDIRECT,
        "state": "estado-1", "nonce": "nonce-1", "code_challenge": challenge,
    })
    return r


def _codigo(r):
    from urllib.parse import parse_qs, urlparse
    return parse_qs(urlparse(r.headers["location"]).query)["code"][0]


def _trocar(cliente, codigo, verificador):
    return cliente.post("/token", data={
        "grant_type": "authorization_code", "code": codigo, "redirect_uri": REDIRECT,
        "client_id": idp.CLIENT_ID, "client_secret": idp.CLIENT_SECRET, "code_verifier": verificador,
    })


def test_discovery_anuncia_pkce_e_rs256(cliente):
    doc = cliente.get("/.well-known/openid-configuration").json()
    assert doc["issuer"] == idp.ISSUER
    assert doc["code_challenge_methods_supported"] == ["S256"]
    assert doc["id_token_signing_alg_values_supported"] == ["RS256"]


def test_fluxo_completo_e_id_token_verificavel_pelo_jwks(cliente):
    verificador, challenge = _par_pkce()
    codigo = _codigo(_autorizar(cliente, challenge))
    r = _trocar(cliente, codigo, verificador)
    assert r.status_code == 200
    id_token = r.json()["id_token"]
    cabecalho, corpo, assinatura = id_token.split(".")
    chave = cliente.get("/jwks.json").json()["keys"][0]
    publica = rsa.RSAPublicNumbers(
        int.from_bytes(_unb64(chave["e"]), "big"), int.from_bytes(_unb64(chave["n"]), "big")
    ).public_key()
    publica.verify(_unb64(assinatura), f"{cabecalho}.{corpo}".encode(), padding.PKCS1v15(), hashes.SHA256())
    claims = json.loads(_unb64(corpo))
    assert claims["cpf"] == "11144477735" and claims["nonce"] == "nonce-1" and claims["aud"] == idp.CLIENT_ID


def test_verificador_pkce_errado_e_recusado(cliente):
    _, challenge = _par_pkce()
    codigo = _codigo(_autorizar(cliente, challenge))
    assert _trocar(cliente, codigo, "verificador-errado-" + "x" * 40).status_code == 400


def test_codigo_so_pode_ser_usado_uma_vez(cliente):
    verificador, challenge = _par_pkce()
    codigo = _codigo(_autorizar(cliente, challenge))
    assert _trocar(cliente, codigo, verificador).status_code == 200
    assert _trocar(cliente, codigo, verificador).status_code == 400


def test_senha_errada_nao_gera_codigo(cliente):
    _, challenge = _par_pkce()
    r = _autorizar(cliente, challenge, senha="errada")
    assert r.status_code == 401 and "location" not in r.headers


def test_redirect_fora_da_lista_e_recusado(cliente):
    _, challenge = _par_pkce()
    r = cliente.get("/authorize", params={
        "client_id": idp.CLIENT_ID, "redirect_uri": "https://atacante.example/x", "response_type": "code",
        "state": "s", "nonce": "n", "code_challenge": challenge, "code_challenge_method": "S256",
    })
    assert r.status_code == 400
