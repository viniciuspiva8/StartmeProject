"""Rotas HTTP da integração: /api/publico, /api/auth (senha e OIDC) e /api/me.

Tudo de aluno sai com `Cache-Control: private, no-store` (o Hosting pode cachear o que não é privado).
O cookie `__session` é o único que o Firebase Hosting repassa ao Cloud Run.
"""

from typing import Callable

import requests
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from integracao import autenticacao, provedores, sessao
from integracao.admin import ServicosAdmin, criar_admin  # noqa: F401 (criar_admin: uso da CLI)
from integracao.config import Config
from integracao.oidc import ClienteOidc, ErroOidc
from integracao.repositorio.firestore import RepositorioFirestore
from integracao.seguranca import LimiteTentativas
from integracao.servicos import ErroIntegracao, Servicos

COOKIE = "__session"
DURACAO_ALUNO = 8 * 3600  # segundos
DURACAO_ADMIN = 2 * 3600


class EntrarIn(BaseModel):
    cpf: str = Field(max_length=32)
    senha: str = Field(max_length=200)


class CurriculoIn(BaseModel):
    dados: dict
    versao: int = Field(ge=0, le=1_000_000)


class MarcacoesIn(BaseModel):
    salvas: list[str] = Field(default_factory=list, max_length=500)
    aplicadas: list[str] = Field(default_factory=list, max_length=500)


class AdminEntrarIn(BaseModel):
    email: str = Field(max_length=254)
    senha: str = Field(max_length=200)


class ConsentimentoIn(BaseModel):
    aceito: bool
    versao: str = Field(max_length=20)


def _erro_validacao(_request, _exc) -> JSONResponse:
    # Sem o eco padrão do FastAPI: a resposta padrão devolveria o CPF e a senha enviados.
    return JSONResponse({"detail": {"codigo": "dados_invalidos"}}, status_code=422)


def _erro(erro: ErroIntegracao) -> HTTPException:
    return HTTPException(status_code=erro.status, detail={"codigo": erro.codigo, **erro.extra})


def _erro_oidc(erro: ErroOidc) -> HTTPException:
    return HTTPException(status_code=erro.status, detail={"codigo": erro.codigo})


def instalar(
    app: FastAPI,
    obter_db: Callable,
    config: Config | None = None,
    repositorio_de: Callable | None = None,
    oidc_http: tuple[Callable, Callable] | None = None,
    coleta: Callable | None = None,
) -> None:
    """Liga a integração ao app. Falha na subida se a configuração não puder ser atendida."""
    cfg = config or Config.do_ambiente()
    app.add_exception_handler(RequestValidationError, _erro_validacao)
    provedor = provedores.construir(cfg)  # erro de configuração aparece aqui, não na primeira requisição
    autenticador = autenticacao.construir(cfg)  # None no modo OIDC
    limite = LimiteTentativas()
    fabrica_repo = repositorio_de or (lambda db: RepositorioFirestore(db))
    get_http, post_http = oidc_http or (requests.get, requests.post)
    oidc = ClienteOidc(cfg, get_http, post_http) if cfg.auth_mode == "oidc" else None

    limite_admin = LimiteTentativas()

    def servicos(db=Depends(obter_db)) -> Servicos:
        return Servicos(cfg, fabrica_repo(db), provedor, autenticador, limite)

    def servicos_admin(db=Depends(obter_db)) -> ServicosAdmin:
        return ServicosAdmin(cfg, fabrica_repo(db), limite_admin, coleta, db)

    def admin(request: Request) -> dict:
        if not cfg.sessao_ativa:
            raise HTTPException(503, detail={"codigo": "sessao_desativada"})
        try:
            return sessao.verificar(request.cookies.get(COOKIE), cfg.sessao_segredo, "admin")
        except sessao.SessaoInvalida as erro:
            raise HTTPException(401, detail={"codigo": "nao_autenticado"}) from erro

    def aluno(request: Request) -> dict:
        if not cfg.sessao_ativa:
            raise HTTPException(503, detail={"codigo": "sessao_desativada"})
        try:
            return sessao.verificar(request.cookies.get(COOKIE), cfg.sessao_segredo, "aluno")
        except sessao.SessaoInvalida as erro:
            raise HTTPException(401, detail={"codigo": "nao_autenticado"}) from erro

    def _cookie_kw() -> dict:
        return {"path": "/", "httponly": True, "secure": not cfg.ambiente_local, "samesite": "lax"}

    def _sessao_do_aluno(resposta: Response, vinculo, chave: str, mascara: str) -> None:
        token = sessao.emitir(
            {"sub": chave, "mascara": mascara, "nome": vinculo.nome, "curso": vinculo.curso,
             "semestre": vinculo.semestre, "ativo": vinculo.ativo},
            cfg.sessao_segredo, "aluno", DURACAO_ALUNO,
        )
        resposta.set_cookie(COOKIE, token, max_age=DURACAO_ALUNO, **_cookie_kw())

    @app.middleware("http")
    async def _cache_privado(request: Request, call_next):
        resposta = await call_next(request)
        if request.url.path.startswith(("/api/me", "/api/auth", "/api/admin")):
            resposta.headers["Cache-Control"] = "private, no-store"
            resposta.headers["Vary"] = "Cookie"
        return resposta

    @app.get("/api/publico/config", tags=["integracao"])
    def publico_config() -> dict:
        return cfg.publico()

    @app.post("/api/auth/entrar", tags=["integracao"])
    def entrar(corpo: EntrarIn, request: Request, response: Response, s: Servicos = Depends(servicos)) -> dict:
        ip = request.client.host if request.client else "desconhecido"
        try:
            vinculo, chave, mascara = s.entrar(corpo.cpf, corpo.senha, ip)
        except ErroIntegracao as erro:
            raise _erro(erro) from erro
        _sessao_do_aluno(response, vinculo, chave, mascara)
        return {"vinculo": vinculo.model_dump(), "cpf_mascarado": mascara}

    @app.post("/api/auth/sair", status_code=204, tags=["integracao"])
    def sair() -> Response:
        resposta = Response(status_code=204)
        resposta.delete_cookie(COOKIE, **_cookie_kw())
        return resposta

    if oidc is not None:
        @app.get("/api/auth/oidc/iniciar", tags=["integracao"])
        def oidc_iniciar() -> RedirectResponse:
            try:
                url = oidc.iniciar()
            except ErroOidc as erro:
                raise _erro_oidc(erro) from erro
            return RedirectResponse(url, status_code=302)

        @app.get("/api/auth/oidc/retorno", tags=["integracao"])
        def oidc_retorno(
            code: str = Query(min_length=1, max_length=2048),
            state: str = Query(min_length=1, max_length=4096),
            s: Servicos = Depends(servicos),
        ) -> RedirectResponse:
            try:
                cpf_digitos = oidc.concluir(code, state)
            except ErroOidc as erro:
                raise _erro_oidc(erro) from erro
            try:
                vinculo, chave, mascara = s.entrar_oidc(cpf_digitos)
            except ErroIntegracao as erro:
                raise _erro(erro) from erro
            destino = cfg.front_url.rstrip("/") + "/#/autorizacao"
            resposta = RedirectResponse(destino, status_code=302)
            _sessao_do_aluno(resposta, vinculo, chave, mascara)
            return resposta

    @app.get("/api/me", tags=["integracao"])
    def me(claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> dict:
        return {
            "vinculo": {"ativo": claims["ativo"], "curso": claims["curso"],
                        "semestre": claims["semestre"], "nome": claims.get("nome")},
            "cpf_mascarado": claims["mascara"],
            "consentimento": s.consentimento(claims["sub"]),
        }

    @app.put("/api/me/consentimento", tags=["integracao"])
    def aceitar(corpo: ConsentimentoIn, claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> dict:
        if not corpo.aceito:
            raise HTTPException(422, detail={"codigo": "consentimento_obrigatorio"})
        try:
            return s.aceitar(claims["sub"], corpo.versao)
        except ErroIntegracao as erro:
            raise _erro(erro) from erro

    @app.get("/api/me/curriculo", tags=["integracao"])
    def curriculo_ler(claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> dict:
        return s.curriculo_obter(claims["sub"])

    @app.put("/api/me/curriculo", tags=["integracao"])
    def curriculo_gravar(corpo: CurriculoIn, claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> dict:
        try:
            return {"versao": s.curriculo_salvar(claims["sub"], corpo.dados, corpo.versao)}
        except ErroIntegracao as erro:
            raise _erro(erro) from erro

    @app.get("/api/me/marcacoes", tags=["integracao"])
    def marcacoes_ler(claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> dict:
        return s.marcacoes_obter(claims["sub"])

    @app.put("/api/me/marcacoes", tags=["integracao"])
    def marcacoes_gravar(corpo: MarcacoesIn, claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> dict:
        s.marcacoes_salvar(claims["sub"], corpo.salvas, corpo.aplicadas)
        return {"salvas": corpo.salvas, "aplicadas": corpo.aplicadas}

    @app.delete("/api/me/consentimento", status_code=204, tags=["integracao"])
    def revogar(claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> Response:
        s.revogar(claims["sub"])
        return Response(status_code=204)

    @app.post("/api/admin/entrar", tags=["admin"])
    def admin_entrar(corpo: AdminEntrarIn, request: Request, response: Response,
                     s: ServicosAdmin = Depends(servicos_admin)) -> dict:
        ip = request.client.host if request.client else "desconhecido"
        try:
            email, papel = s.entrar(corpo.email, corpo.senha, ip)
        except ErroIntegracao as erro:
            raise _erro(erro) from erro
        token = sessao.emitir({"sub": email, "role": papel}, cfg.sessao_segredo, "admin", DURACAO_ADMIN)
        response.set_cookie(COOKIE, token, max_age=DURACAO_ADMIN, **_cookie_kw())
        return {"email": email, "papel": papel}

    @app.post("/api/admin/sair", status_code=204, tags=["admin"])
    def admin_sair() -> Response:
        resposta = Response(status_code=204)
        resposta.delete_cookie(COOKIE, **_cookie_kw())
        return resposta

    @app.get("/api/admin/resumo", tags=["admin"])
    def admin_resumo(claims: dict = Depends(admin), s: ServicosAdmin = Depends(servicos_admin)) -> dict:
        return {**s.resumo(), "email": claims["sub"], "papel": claims["role"]}

    @app.post("/api/admin/coleta", tags=["admin"])
    def admin_coleta(claims: dict = Depends(admin), s: ServicosAdmin = Depends(servicos_admin)) -> dict:
        try:
            return s.coletar(claims["sub"], claims["role"])
        except ErroIntegracao as erro:
            raise _erro(erro) from erro

    @app.get("/api/admin/auditoria", tags=["admin"])
    def admin_auditoria(limite: int = Query(default=50, ge=1, le=200), claims: dict = Depends(admin),
                        s: ServicosAdmin = Depends(servicos_admin)) -> list:
        return s.auditoria(limite)

    @app.delete("/api/me", status_code=204, tags=["integracao"])
    def apagar_conta(claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> Response:
        s.apagar_conta(claims["sub"])
        resposta = Response(status_code=204)
        resposta.delete_cookie(COOKIE, **_cookie_kw())
        return resposta
