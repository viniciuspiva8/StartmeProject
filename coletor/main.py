"""
StartMe - Servico de coleta de vagas.

Coleta vagas de estagio, trainee e junior em TI pela SerpApi (Google Jobs),
persiste no Google Cloud Firestore e expoe a colecao por uma API HTTP.

Toda a configuracao vem de variaveis de ambiente (ver .env.example).
Nenhum segredo e versionado.
"""
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import firebase_admin
from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel

from fontes import serpapi
from fontes.serpapi import ResultadoSerpapi

# --------------------------------------------------------------------------
# Configuracao
# --------------------------------------------------------------------------
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-7s %(name)s - %(message)s",
)
serpapi.instalar_redacao_logs()  # a api_key vai na query string: nunca pode ir para o log
log = logging.getLogger("startme.coletor")

CRED_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciais.json")
SCRAPER_TOKEN = os.getenv("SCRAPER_TOKEN")

# Origens de desenvolvimento: Vite (dev 5173 e preview 4173) e Live Server (5500).
# Em producao, defina ALLOWED_ORIGINS com o dominio real do frontend.
ORIGENS_DEV = [
    f"http://{host}:{porta}"
    for porta in (5173, 4173, 5500)
    for host in ("localhost", "127.0.0.1")
]


def _origens_permitidas(bruto: Optional[str]) -> List[str]:
    """Lista explicita de origens. Nunca curinga; barra final e removida.

    O navegador envia a origem sem "/" no fim, entao "http://x:5173/" nunca
    casaria. "*" e descartado com aviso: o contrato e lista explicita.
    """
    if not bruto or not bruto.strip():
        return list(ORIGENS_DEV)
    origens = []
    for origem in (o.strip().rstrip("/") for o in bruto.split(",")):
        if origem == "*":
            log.warning("ALLOWED_ORIGINS contem '*': ignorado. Liste as origens explicitamente.")
        elif origem:
            origens.append(origem)
    return origens


ALLOWED_ORIGINS = _origens_permitidas(os.getenv("ALLOWED_ORIGINS"))
COLECAO = serpapi.COLECAO_VAGAS

# Cache em memoria de GET /api/vagas (segundos; 0 desliga). Os dados so mudam quando a coleta
# roda, entao um TTL de 1 a 5 minutos e semanticamente gratuito e poupa a cota do Firestore
# (50 mil leituras/dia no plano gratuito; sem cache, cada requisicao le a colecao inteira).
VAGAS_CACHE_TTL = int(os.getenv("VAGAS_CACHE_TTL", "120"))

# Variavel vazia nao e "desligada" para a biblioteca do Firestore: remove-a.
if "FIRESTORE_EMULATOR_HOST" in os.environ and not os.environ["FIRESTORE_EMULATOR_HOST"].strip():
    del os.environ["FIRESTORE_EMULATOR_HOST"]

_db = None


def get_db():
    """Cliente do Firestore, criado na primeira chamada.

    Fica fora do import para que os testes possam substitui-lo (dependency
    override) sem credencial do Firebase.

    Se FIRESTORE_EMULATOR_HOST estiver definido (desenvolvimento local), usa o
    emulador com credencial anonima: nenhum arquivo de credencial e necessario
    e nada sai para o Firebase real.
    """
    global _db
    if _db is None and os.getenv("FIRESTORE_EMULATOR_HOST"):
        from google.auth.credentials import AnonymousCredentials
        from google.cloud import firestore as gcf

        projeto = os.getenv("GOOGLE_CLOUD_PROJECT", "startme-local")
        log.warning(
            "Firestore EMULADOR em %s (projeto '%s'): nao e o Firebase real.",
            os.environ["FIRESTORE_EMULATOR_HOST"], projeto,
        )
        _db = gcf.Client(project=projeto, credentials=AnonymousCredentials())
    if _db is None:
        projeto = os.getenv("GOOGLE_CLOUD_PROJECT")
        if os.path.exists(CRED_PATH):
            firebase_admin.initialize_app(credentials.Certificate(CRED_PATH))
        elif projeto:
            # Sem chave em arquivo (a organizacao pode bloquear a criacao de chaves): usa as
            # Application Default Credentials (gcloud auth application-default login, ou a
            # identidade da maquina em producao).
            log.warning("Sem '%s': usando Application Default Credentials (projeto '%s').", CRED_PATH, projeto)
            firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": projeto})
        else:
            raise RuntimeError(
                f"Credencial do Firebase nao encontrada em '{CRED_PATH}'. "
                "Baixe o JSON da conta de servico e aponte GOOGLE_APPLICATION_CREDENTIALS para ele, "
                "ou defina GOOGLE_CLOUD_PROJECT para usar as Application Default Credentials. "
                "Nenhum arquivo de credencial deve ser versionado."
            )
        _db = firestore.client()
    return _db


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_db()  # falha rapido na subida se a credencial nao existir
    yield


app = FastAPI(
    title="StartMe - Coletor de Vagas",
    version="0.3.0",
    description="Coleta, armazena e disponibiliza vagas de estagio e junior em TI.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # lista explícita (nunca "*"): com credenciais o navegador exige origem exata
    allow_credentials=True,  # o cookie __session da sessão do aluno e do admin precisa ir junto
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Scraper-Token"],
)


# --------------------------------------------------------------------------
# Modelos
# --------------------------------------------------------------------------
class Vaga(BaseModel):
    id: str
    titulo: str
    empresa: str
    link: str
    data_coleta: str
    descricao: str = ""
    salario: str = ""
    # Campos extras: vagas gravadas antes da SerpApi nao tem fonte, via nem logo.
    fonte: str = "companhia_estagios"
    via: str = ""
    # Logo da empresa como data URI (vazio = a interface mostra a letra da empresa).
    logo: str = ""


class ResultadoColeta(BaseModel):
    vagas_expiradas_removidas: int
    vagas_novas: int
    vagas_renovadas: int
    # Vagas unicas que passaram no filtro de estagio/trainee/junior nesta execucao.
    cards_encontrados: int
    serpapi: Optional[ResultadoSerpapi] = None


# --------------------------------------------------------------------------
# Seguranca
# --------------------------------------------------------------------------
def exigir_token(x_scraper_token: Optional[str] = Header(default=None)) -> None:
    """Protege as rotas de escrita. Sem token configurado, a rota nao opera."""
    if not SCRAPER_TOKEN:
        log.error("SCRAPER_TOKEN nao configurado; rota de escrita desabilitada.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Coleta desabilitada: SCRAPER_TOKEN nao configurado no servidor.",
        )
    if x_scraper_token != SCRAPER_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido ou ausente."
        )


# --------------------------------------------------------------------------
# Rotas de leitura
# --------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "colecao": COLECAO}


def _ler_vagas(db) -> List[Vaga]:
    """Le a colecao inteira do Firestore (uma leitura por documento)."""
    vagas: List[Vaga] = []
    for doc in db.collection(COLECAO).stream():
        dados = doc.to_dict() or {}
        vagas.append(
            Vaga(
                id=doc.id,
                titulo=dados.get("titulo", ""),
                empresa=dados.get("empresa", ""),
                link=dados.get("link", ""),
                data_coleta=str(dados.get("data_coleta", "")),
                descricao=dados.get("descricao", ""),
                salario=dados.get("salario", ""),
                fonte=dados.get("fonte") or "companhia_estagios",
                via=dados.get("via") or "",
                logo=dados.get("logo") or "",
            )
        )
    return vagas


class CacheVagas:
    """Cache em memoria da lista de vagas, com TTL.

    * Uma unica leitura do Firestore por janela de TTL, mesmo com muitas requisicoes.
    * `invalidar()` e chamado quando os dados mudam (coleta); a copia vencida fica guardada.
    * Se o Firestore falhar (cota estourada, rede), serve a copia vencida em vez de dar erro.
    * Um processo, uma instancia: com varias replicas cada uma teria o seu cache.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.limpar()

    def limpar(self) -> None:
        self._vagas: Optional[List[Vaga]] = None
        self._expira = 0.0
        self.hits = 0
        self.misses = 0

    def invalidar(self) -> None:
        with self._lock:
            self._expira = 0.0

    def obter(self, db) -> Tuple[List[Vaga], str]:
        """Devolve (vagas, estado) com estado em HIT, MISS ou STALE."""
        with self._lock:
            if VAGAS_CACHE_TTL > 0 and self._vagas is not None and time.monotonic() < self._expira:
                self.hits += 1
                return self._vagas, "HIT"
            try:
                vagas = _ler_vagas(db)
            except Exception:
                if self._vagas is None:
                    raise
                log.warning("Firestore indisponivel: servindo a copia vencida das vagas.")
                return self._vagas, "STALE"
            self.misses += 1
            self._vagas = vagas
            self._expira = time.monotonic() + VAGAS_CACHE_TTL
            log.info("Vagas lidas do Firestore: %s documentos (cache: %s acertos, %s leituras).",
                     len(vagas), self.hits, self.misses)
            return vagas, "MISS"


cache_vagas = CacheVagas()


@app.get("/api/vagas", response_model=List[Vaga])
def listar_vagas(response: Response, db=Depends(get_db)) -> List[Vaga]:
    """Devolve as vagas registradas no Firestore (com cache em memoria de VAGAS_CACHE_TTL s)."""
    vagas, estado = cache_vagas.obter(db)
    response.headers["X-Cache"] = estado  # HIT/MISS/STALE: evidencia para o ensaio de carga
    if VAGAS_CACHE_TTL > 0:
        response.headers["Cache-Control"] = f"public, max-age={min(VAGAS_CACHE_TTL, 60)}"
    return vagas


# --------------------------------------------------------------------------
# Coleta
# --------------------------------------------------------------------------
def _remover_expiradas(db, agora: datetime) -> int:
    """Apaga em lote as vagas (de qualquer fonte) cuja data de expiracao ja passou."""
    expiradas = db.collection(COLECAO).where(
        filter=FieldFilter("data_expiracao", "<", agora)
    ).stream()

    lote = db.batch()
    total = pendentes = 0
    for doc in expiradas:
        lote.delete(doc.reference)
        total += 1
        pendentes += 1
        if pendentes == 400:  # limite de 500 operacoes por lote no Firestore
            lote.commit()
            lote = db.batch()
            pendentes = 0
    if pendentes:
        lote.commit()
    return total


@app.post(
    "/api/coleta",
    response_model=ResultadoColeta,
    dependencies=[Depends(exigir_token)],
)
def executar_coleta(db=Depends(get_db)) -> ResultadoColeta:
    """Remove vagas expiradas e coleta vagas novas pela SerpApi."""
    agora = datetime.now(timezone.utc)

    try:
        removidas = _remover_expiradas(db, agora)
        log.info("Limpeza concluida: %s vagas expiradas removidas.", removidas)
        resultado = serpapi.coletar(db, agora=agora)
    finally:
        cache_vagas.invalidar()  # os dados mudaram (ou podem ter mudado): a proxima leitura vai ao Firestore
    return ResultadoColeta(
        vagas_expiradas_removidas=removidas,
        vagas_novas=resultado.vagas_novas,
        vagas_renovadas=resultado.vagas_renovadas,
        cards_encontrados=resultado.vagas_unicas,
        serpapi=resultado,
    )


# --------------------------------------------------------------------------
# Integração acadêmica (ADR-002): /api/publico, /api/auth e /api/me
# --------------------------------------------------------------------------
from integracao.rotas import instalar as _instalar_integracao  # noqa: E402

_instalar_integracao(app, get_db, coleta=lambda db: executar_coleta(db=db))  # admin dispara a mesma coleta
