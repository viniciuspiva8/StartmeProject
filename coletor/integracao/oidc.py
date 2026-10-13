"""Login único da FSA: OpenID Connect com authorization code + PKCE (S256), id_token RS256.

Desenho pensado para o Firebase Hosting (que só repassa o cookie `__session` ao Cloud Run):
- O `state` é um token assinado com SESSAO_SEGREDO, com um identificador aleatório (jti) e o nonce.
  Não há cookie extra nem armazenamento: o retorno funciona em qualquer instância do Cloud Run.
- O verificador PKCE é derivado do segredo do servidor e do jti. Ele nunca aparece na URL:
  o IdP só vê o challenge (hash dele).
- O id_token é validado com a chave pública do JWKS: alg RS256 apenas, assinatura, iss, aud,
  exp, iat, nonce e o claim de CPF.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Callable
from urllib.parse import urlencode

import requests
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from integracao import cpf as cpf_mod
from integracao import sessao
from integracao.config import Config

SKEW = 60  # segundos de tolerância no relógio
VIDA_STATE = 600
JWKS_MIN_INTERVALO = 60  # não recarrega as chaves mais de uma vez por minuto (evita abuso)
JWKS_TTL = 3600


class ErroOidc(Exception):
    def __init__(self, codigo: str, status: int = 400):
        super().__init__(codigo)
        self.codigo = codigo
        self.status = status


def _b64(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode("ascii")


def _des_b64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def verificador_pkce(segredo: bytes, jti: str) -> str:
    return _b64(hmac.new(segredo, b"pkce|" + jti.encode("ascii"), hashlib.sha256).digest())


def challenge_s256(verificador: str) -> str:
    return _b64(hashlib.sha256(verificador.encode("ascii")).digest())


class ClienteOidc:
    def __init__(
        self,
        config: Config,
        http_get: Callable = requests.get,
        http_post: Callable = requests.post,
        agora: Callable[[], float] = time.time,
    ):
        self._cfg = config
        self._get = http_get
        self._post = http_post
        self._agora = agora
        self._desc: dict | None = None
        self._chaves: dict[str, rsa.RSAPublicKey] = {}
        self._chaves_em = 0.0

    # ----------------------------------------------------------- discovery e chaves
    def _url_segura(self, url: str) -> bool:
        return url.startswith("https://") or (self._cfg.ambiente_local and url.startswith("http://"))

    def descoberta(self) -> dict:
        if self._desc is None:
            if not self._cfg.oidc_issuer:
                raise ErroOidc("oidc_nao_configurado", 503)
            try:
                resposta = self._get(
                    self._cfg.oidc_issuer.rstrip("/") + "/.well-known/openid-configuration",
                    timeout=self._cfg.timeout,
                )
            except requests.RequestException as erro:
                raise ErroOidc("idp_indisponivel", 503) from erro
            if resposta.status_code != 200:
                raise ErroOidc("idp_indisponivel", 503)
            try:
                doc = resposta.json()
            except ValueError as erro:
                raise ErroOidc("idp_indisponivel", 503) from erro
            if doc.get("issuer") != self._cfg.oidc_issuer:
                raise ErroOidc("issuer_divergente", 500)
            for campo in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
                if not self._url_segura(str(doc.get(campo, ""))):
                    raise ErroOidc("endpoint_inseguro", 500)
            self._desc = doc
        return self._desc

    def _carregar_chaves(self) -> None:
        try:
            resposta = self._get(self.descoberta()["jwks_uri"], timeout=self._cfg.timeout)
            corpo = resposta.json() if resposta.status_code == 200 else None
        except (requests.RequestException, ValueError) as erro:
            raise ErroOidc("idp_indisponivel", 503) from erro
        if not isinstance(corpo, dict):
            raise ErroOidc("idp_indisponivel", 503)
        novas: dict[str, rsa.RSAPublicKey] = {}
        for chave in corpo.get("keys", []):
            if chave.get("kty") != "RSA" or chave.get("use", "sig") != "sig":
                continue
            numeros = rsa.RSAPublicNumbers(
                int.from_bytes(_des_b64(chave["e"]), "big"), int.from_bytes(_des_b64(chave["n"]), "big")
            )
            novas[str(chave.get("kid"))] = numeros.public_key()
        self._chaves = novas
        self._chaves_em = self._agora()

    def _chave(self, kid: str) -> rsa.RSAPublicKey:
        agora = self._agora()
        fresca = agora - self._chaves_em < JWKS_TTL
        if kid in self._chaves and fresca:
            return self._chaves[kid]
        if agora - self._chaves_em >= JWKS_MIN_INTERVALO:
            self._carregar_chaves()
            if kid in self._chaves:
                return self._chaves[kid]
        raise ErroOidc("chave_desconhecida")

    # ----------------------------------------------------------------- fluxo
    def iniciar(self) -> str:
        """URL de autorização para onde o navegador deve ir."""
        cfg = self._cfg
        if not cfg.sessao_ativa or not cfg.oidc_client_id or not cfg.oidc_redirect_uri:
            raise ErroOidc("oidc_nao_configurado", 503)
        jti = secrets.token_urlsafe(16)
        nonce = secrets.token_urlsafe(16)
        state = sessao.emitir({"jti": jti, "nonce": nonce}, cfg.sessao_segredo, "oidc-state", VIDA_STATE)
        parametros = {
            "client_id": cfg.oidc_client_id,
            "redirect_uri": cfg.oidc_redirect_uri,
            "response_type": "code",
            "scope": "openid",
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge_s256(verificador_pkce(cfg.sessao_segredo, jti)),
            "code_challenge_method": "S256",
        }
        return self.descoberta()["authorization_endpoint"] + "?" + urlencode(parametros)

    def concluir(self, code: str, state: str) -> str:
        """Troca o código, valida o id_token e devolve o CPF (11 dígitos). Nunca loga o CPF."""
        cfg = self._cfg
        try:
            estado = sessao.verificar(state, cfg.sessao_segredo, "oidc-state")
        except sessao.SessaoInvalida as erro:
            raise ErroOidc("state_invalido") from erro
        verificador = verificador_pkce(cfg.sessao_segredo, estado["jti"])
        try:
            resposta = self._post(
                self.descoberta()["token_endpoint"],
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": cfg.oidc_redirect_uri,
                    "client_id": cfg.oidc_client_id,
                    "client_secret": cfg.oidc_client_secret or "",
                    "code_verifier": verificador,
                },
                timeout=cfg.timeout,
            )
        except requests.RequestException as erro:
            raise ErroOidc("idp_indisponivel", 503) from erro
        if resposta.status_code != 200:
            raise ErroOidc("troca_de_codigo_recusada")
        try:
            id_token = resposta.json()["id_token"]
        except (ValueError, KeyError, TypeError) as erro:
            raise ErroOidc("id_token_ausente") from erro
        claims = self._validar(id_token, estado["nonce"])
        try:
            return cpf_mod.normalizar(str(claims.get(cfg.oidc_cpf_claim)))
        except cpf_mod.CpfInvalido as erro:
            raise ErroOidc("cpf_ausente") from erro

    def _validar(self, id_token: str, nonce: str) -> dict:
        cfg = self._cfg
        try:
            cab_b, corpo_b, ass_b = id_token.split(".")
            cabecalho = json.loads(_des_b64(cab_b))
            corpo = json.loads(_des_b64(corpo_b))
            assinatura = _des_b64(ass_b)
        except (ValueError, TypeError, UnicodeDecodeError) as erro:
            raise ErroOidc("id_token_invalido") from erro
        if not isinstance(cabecalho, dict) or not isinstance(corpo, dict):
            raise ErroOidc("id_token_invalido")
        if cabecalho.get("alg") != "RS256":
            raise ErroOidc("alg_nao_aceito")
        chave = self._chave(str(cabecalho.get("kid")))
        try:
            chave.verify(assinatura, f"{cab_b}.{corpo_b}".encode("ascii"), padding.PKCS1v15(), hashes.SHA256())
        except InvalidSignature as erro:
            raise ErroOidc("assinatura_invalida") from erro
        agora = self._agora()
        if corpo.get("iss") != cfg.oidc_issuer:
            raise ErroOidc("iss_invalido")
        aud = corpo.get("aud")
        if cfg.oidc_client_id not in (aud if isinstance(aud, list) else [aud]):
            raise ErroOidc("aud_invalido")
        exp = corpo.get("exp")
        if not isinstance(exp, (int, float)) or exp < agora - SKEW:
            raise ErroOidc("expirado")
        iat = corpo.get("iat")
        if not isinstance(iat, (int, float)):
            raise ErroOidc("iat_invalido")
        if iat > agora + SKEW:
            raise ErroOidc("iat_futuro")
        if not hmac.compare_digest(str(corpo.get("nonce", "")).encode("utf-8"), nonce.encode("utf-8")):
            raise ErroOidc("nonce_invalido")
        return corpo
