"""Rotas HTTP da integração: /api/publico, /api/auth e /api/me.

Tudo de aluno sai com `Cache-Control: private, no-store` (o Hosting pode cachear o que não é privado).
O cookie `__session` é o único que o Firebase Hosting repassa ao Cloud Run.
"""

from typing import Callable

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field

from integracao import autenticacao, provedores, sessao
from integracao.config import Config
from integracao.repositorio.firestore import RepositorioFirestore
from integracao.seguranca import LimiteTentativas
from integracao.servicos import ErroIntegracao, Servicos

COOKIE = "__session"
DURACAO_ALUNO = 8 * 3600  # segundos


class EntrarIn(BaseModel):
    cpf: str = Field(max_length=32)
    senha: str = Field(max_length=200)


class ConsentimentoIn(BaseModel):
    aceito: bool
    versao: str = Field(max_length=20)


def _erro(erro: ErroIntegracao) -> HTTPException:
    return HTTPException(status_code=erro.status, detail={"codigo": erro.codigo})


def instalar(app: FastAPI, obter_db: Callable, config: Config | None = None, repositorio_de: Callable | None = None) -> None:
    """Liga a integração ao app. Falha na subida se a configuração não puder ser atendida."""
    cfg = config or Config.do_ambiente()
    provedor = provedores.construir(cfg)  # erro de configuração aparece aqui, não na primeira requisição
    autenticador = autenticacao.construir(cfg)
    limite = LimiteTentativas()
    fabrica_repo = repositorio_de or (lambda db: RepositorioFirestore(db))

    def servicos(db=Depends(obter_db)) -> Servicos:
        return Servicos(cfg, fabrica_repo(db), provedor, autenticador, limite)

    def aluno(request: Request) -> dict:
        if not cfg.sessao_ativa:
            raise HTTPException(503, detail={"codigo": "sessao_desativada"})
        try:
            return sessao.verificar(request.cookies.get(COOKIE), cfg.sessao_segredo, "aluno")
        except sessao.SessaoInvalida as erro:
            raise HTTPException(401, detail={"codigo": "nao_autenticado"}) from erro

    def _cookie_kw() -> dict:
        return {"path": "/", "httponly": True, "secure": not cfg.ambiente_local, "samesite": "lax"}

    @app.middleware("http")
    async def _cache_privado(request: Request, call_next):
        resposta = await call_next(request)
        if request.url.path.startswith(("/api/me", "/api/auth")):
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
        token = sessao.emitir(
            {"sub": chave, "mascara": mascara, "nome": vinculo.nome, "curso": vinculo.curso,
             "semestre": vinculo.semestre, "ativo": vinculo.ativo},
            cfg.sessao_segredo, "aluno", DURACAO_ALUNO,
        )
        response.set_cookie(COOKIE, token, max_age=DURACAO_ALUNO, **_cookie_kw())
        return {"vinculo": vinculo.model_dump(), "cpf_mascarado": mascara}

    @app.post("/api/auth/sair", status_code=204, tags=["integracao"])
    def sair() -> Response:
        resposta = Response(status_code=204)
        resposta.delete_cookie(COOKIE, **_cookie_kw())
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

    @app.delete("/api/me/consentimento", status_code=204, tags=["integracao"])
    def revogar(claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> Response:
        s.revogar(claims["sub"])
        return Response(status_code=204)

    @app.delete("/api/me", status_code=204, tags=["integracao"])
    def apagar_conta(claims: dict = Depends(aluno), s: Servicos = Depends(servicos)) -> Response:
        s.apagar_conta(claims["sub"])
        resposta = Response(status_code=204)
        resposta.delete_cookie(COOKIE, **_cookie_kw())
        return resposta
