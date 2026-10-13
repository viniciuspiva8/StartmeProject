"""Login único (OIDC): fluxo completo contra o IdP falso do simulador e ataques contra o id_token.

O IdP é carregado do simulador-fsa/idp/app.py (mesmo código que roda no Docker). As chamadas HTTP
do StartMe vão direto para o TestClient do IdP, sem rede.
"""

import base64
import importlib.util
import json
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from integracao import oidc, sessao
from integracao.config import Config
from integracao.oidc import ClienteOidc, ErroOidc
from integracao.rotas import COOKIE, instalar
from integracao.repositorio import RepositorioMemoria

RAIZ = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("idp_fsa_oidc", RAIZ / "simulador-fsa" / "idp" / "app.py")
idp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(idp)

SEGREDO = b"s" * 32
PEPPER = b"p" * 32
REDIRECT = "http://localhost:8080/api/auth/oidc/retorno"
FRONT = "http://localhost:5173"


def _b64(d: bytes) -> str:
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()


class _Resp:
    def __init__(self, status, corpo=None):
        self.status_code = status
        self._corpo = corpo

    def json(self):
        if self._corpo is None:
            raise ValueError("sem corpo")
        return self._corpo


class IdpPorTestClient:
    """Ponte HTTP: as chamadas do StartMe para o endereço do IdP viram chamadas ao TestClient do IdP."""

    def __init__(self, cliente):
        self.c = cliente

    def _caminho(self, url):
        assert url.startswith(idp.ISSUER), url
        return url[len(idp.ISSUER):]

    def get(self, url, headers=None, timeout=None):
        r = self.c.get(self._caminho(url))
        return _Resp(r.status_code, r.json() if r.headers.get("content-type", "").startswith("application/json") else None)

    def post(self, url, data=None, timeout=None, **kw):
        r = self.c.post(self._caminho(url), data=data)
        return _Resp(r.status_code, r.json() if r.headers.get("content-type", "").startswith("application/json") else None)


def _config(**extra):
    base = dict(
        auth_mode="oidc", provedor="arquivo", sessao_segredo=SEGREDO, cpf_pepper=PEPPER,
        oidc_issuer=idp.ISSUER, oidc_client_id=idp.CLIENT_ID, oidc_client_secret=idp.CLIENT_SECRET,
        oidc_redirect_uri=REDIRECT, oidc_cpf_claim="cpf", ambiente_local=True, front_url=FRONT,
    )
    base.update(extra)
    return Config(**base)


@pytest.fixture
def idp_cliente():
    return TestClient(idp.criar_app(), follow_redirects=False)


@pytest.fixture
def app_aluno(fake_db, idp_cliente):
    app = FastAPI()
    instalar(app, lambda: fake_db, _config(), repositorio_de=lambda db: RepositorioMemoria(),
             oidc_http=(IdpPorTestClient(idp_cliente).get, IdpPorTestClient(idp_cliente).post))
    return TestClient(app, follow_redirects=False)


def _navegador_no_idp(idp_cliente, url_autorizacao, cpf="111.444.777-35", senha="senha"):
    """Simula o aluno na tela da FSA: preenche o formulário e devolve a URL de retorno."""
    query = parse_qs(urlparse(url_autorizacao).query)
    campos = {k: v[0] for k, v in query.items()}
    r = idp_cliente.post("/authorize/confirmar", data={
        "cpf": cpf, "senha": senha, "client_id": campos["client_id"], "redirect_uri": campos["redirect_uri"],
        "state": campos["state"], "nonce": campos["nonce"], "code_challenge": campos["code_challenge"],
    })
    assert r.status_code == 302, r.text
    return r.headers["location"]


def _login(app_aluno, idp_cliente, cpf="111.444.777-35"):
    inicio = app_aluno.get("/api/auth/oidc/iniciar")
    assert inicio.status_code == 302
    url = inicio.headers["location"]
    retorno_idp = _navegador_no_idp(idp_cliente, url, cpf=cpf)
    qs = parse_qs(urlparse(retorno_idp).query)
    return app_aluno.get("/api/auth/oidc/retorno", params={"code": qs["code"][0], "state": qs["state"][0]})


# ----------------------------------------------------------------- fluxo feliz
def test_login_completo_cria_sessao_sem_cpf(app_aluno, idp_cliente):
    r = _login(app_aluno, idp_cliente)
    assert r.status_code == 302
    assert r.headers["location"] == f"{FRONT}/#/autorizacao"
    assert f"{COOKIE}=" in r.headers["set-cookie"].lower()
    me = app_aluno.get("/api/me")
    assert me.status_code == 200
    assert me.json()["vinculo"]["curso"] == "Engenharia de Computação"
    assert "11144477735" not in me.text and "111.444" not in me.text


def test_url_de_inicio_usa_pkce_s256_e_nonce(app_aluno):
    url = app_aluno.get("/api/auth/oidc/iniciar").headers["location"]
    q = parse_qs(urlparse(url).query)
    assert q["code_challenge_method"] == ["S256"] and q["response_type"] == ["code"]
    assert q["scope"] == ["openid"] and len(q["nonce"][0]) >= 16 and len(q["state"][0]) > 50


def test_verificador_pkce_nao_aparece_na_url(app_aluno):
    url = app_aluno.get("/api/auth/oidc/iniciar").headers["location"]
    state = parse_qs(urlparse(url).query)["state"][0]
    jti = sessao.verificar(state, SEGREDO, "oidc-state")["jti"]
    assert oidc.verificador_pkce(SEGREDO, jti) not in url


def test_trancado_no_login_da_fsa_recebe_403(app_aluno, idp_cliente):
    r = _login(app_aluno, idp_cliente, cpf="123.456.789-09")
    assert r.status_code == 403 and r.json()["detail"]["codigo"] == "vinculo_inativo"


def test_login_por_senha_fica_desligado_no_modo_oidc(app_aluno):
    r = app_aluno.post("/api/auth/entrar", json={"cpf": "111.444.777-35", "senha": "senha"})
    assert r.status_code == 404 and r.json()["detail"]["codigo"] == "login_por_senha_desativado"


# ----------------------------------------------------------------- ataques ao retorno
def test_state_forjado_ou_adulterado_e_recusado(app_aluno, idp_cliente):
    url = app_aluno.get("/api/auth/oidc/iniciar").headers["location"]
    retorno = _navegador_no_idp(idp_cliente, url)
    code = parse_qs(urlparse(retorno).query)["code"][0]
    r = app_aluno.get("/api/auth/oidc/retorno", params={"code": code, "state": "forjado.x.y"})
    assert r.status_code == 400 and r.json()["detail"]["codigo"] == "state_invalido"


def test_nonce_trocado_no_state_e_recusado(app_aluno, idp_cliente):
    url = app_aluno.get("/api/auth/oidc/iniciar").headers["location"]
    q = parse_qs(urlparse(url).query)
    estado = sessao.verificar(q["state"][0], SEGREDO, "oidc-state")
    estado_alterado = sessao.emitir({"jti": estado["jti"], "nonce": "outro-nonce"}, SEGREDO, "oidc-state", 600)
    retorno = _navegador_no_idp(idp_cliente, url)
    code = parse_qs(urlparse(retorno).query)["code"][0]
    r = app_aluno.get("/api/auth/oidc/retorno", params={"code": code, "state": estado_alterado})
    assert r.status_code == 400 and r.json()["detail"]["codigo"] == "nonce_invalido"


def test_codigo_reutilizado_e_recusado(app_aluno, idp_cliente):
    url = app_aluno.get("/api/auth/oidc/iniciar").headers["location"]
    retorno = _navegador_no_idp(idp_cliente, url)
    qs = parse_qs(urlparse(retorno).query)
    assert app_aluno.get("/api/auth/oidc/retorno", params={"code": qs["code"][0], "state": qs["state"][0]}).status_code == 302
    r = app_aluno.get("/api/auth/oidc/retorno", params={"code": qs["code"][0], "state": qs["state"][0]})
    assert r.status_code == 400 and r.json()["detail"]["codigo"] == "troca_de_codigo_recusada"


# ----------------------------------------------------------------- ataques ao id_token
def _cliente_com_id_token(id_token: str) -> ClienteOidc:
    """Cliente cujo endpoint de token devolve o id_token dado; discovery e JWKS vêm do IdP real."""
    ponte = IdpPorTestClient(TestClient(idp.criar_app()))

    def post(url, data=None, timeout=None, **kw):
        return _Resp(200, {"id_token": id_token})

    return ClienteOidc(_config(), ponte.get, post, agora=time.time)


def _state_valido(cliente: ClienteOidc) -> str:
    url = cliente.iniciar()
    return parse_qs(urlparse(url).query)["state"][0]


def _assinado(claims: dict) -> str:
    """id_token assinado pela chave REAL do IdP (o que um IdP legítimo faria)."""
    return idp.assinar_jwt(claims)


def _claims(**extra):
    agora = int(time.time())
    base = {"iss": idp.ISSUER, "sub": "x", "aud": idp.CLIENT_ID, "iat": agora, "exp": agora + 300,
            "nonce": "__NONCE__", "cpf": "11144477735"}
    base.update(extra)
    return base


@pytest.mark.parametrize("corpo_alterado, codigo", [
    ({"aud": "outro-cliente"}, "aud_invalido"),
    ({"iss": "https://atacante.example"}, "iss_invalido"),
    ({"exp": int(time.time()) - 3600}, "expirado"),
    ({"iat": int(time.time()) + 3600}, "iat_futuro"),
])
def test_id_token_assinado_mas_com_claim_errado_e_recusado(corpo_alterado, codigo):
    base_cliente = _cliente_com_id_token("x.y.z")
    state = _state_valido(base_cliente)
    nonce = sessao.verificar(state, SEGREDO, "oidc-state")["nonce"]
    token = _assinado({**_claims(), "nonce": nonce, **corpo_alterado})
    cliente = _cliente_com_id_token(token)
    with pytest.raises(ErroOidc) as erro:
        cliente.concluir("codigo-qualquer", state)
    assert erro.value.codigo == codigo


def test_algoritmo_none_e_recusado():
    base_cliente = _cliente_com_id_token("x.y.z")
    state = _state_valido(base_cliente)
    nonce = sessao.verificar(state, SEGREDO, "oidc-state")["nonce"]
    cab = _b64(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    corpo = _b64(json.dumps({**_claims(), "nonce": nonce}).encode())
    cliente = _cliente_com_id_token(f"{cab}.{corpo}.")
    with pytest.raises(ErroOidc) as erro:
        cliente.concluir("c", state)
    assert erro.value.codigo == "alg_nao_aceito"


def test_assinatura_de_outra_chave_e_recusada():
    chave_falsa = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    base_cliente = _cliente_com_id_token("x.y.z")
    state = _state_valido(base_cliente)
    nonce = sessao.verificar(state, SEGREDO, "oidc-state")["nonce"]
    cab = _b64(json.dumps({"alg": "RS256", "typ": "JWT", "kid": "chave-do-atacante"}).encode())
    corpo = _b64(json.dumps({**_claims(), "nonce": nonce}).encode())
    assinatura = _b64(chave_falsa.sign(f"{cab}.{corpo}".encode(), padding.PKCS1v15(), hashes.SHA256()))
    cliente = _cliente_com_id_token(f"{cab}.{corpo}.{assinatura}")
    with pytest.raises(ErroOidc) as erro:
        cliente.concluir("c", state)
    assert erro.value.codigo == "chave_desconhecida"


def test_cpf_ausente_no_token_e_recusado():
    base_cliente = _cliente_com_id_token("x.y.z")
    state = _state_valido(base_cliente)
    nonce = sessao.verificar(state, SEGREDO, "oidc-state")["nonce"]
    claims = {k: v for k, v in _claims(nonce=nonce).items() if k != "cpf"}
    cliente = _cliente_com_id_token(_assinado(claims))
    with pytest.raises(ErroOidc) as erro:
        cliente.concluir("c", state)
    assert erro.value.codigo == "cpf_ausente"


def test_discovery_com_issuer_divergente_e_recusado():
    class DescobertaRuim:
        def get(self, url, timeout=None, headers=None):
            return _Resp(200, {"issuer": "https://outro", "authorization_endpoint": "x",
                               "token_endpoint": "x", "jwks_uri": "x"})
    cliente = ClienteOidc(_config(), DescobertaRuim().get, None)
    with pytest.raises(ErroOidc) as erro:
        cliente.iniciar()
    assert erro.value.codigo == "issuer_divergente"
