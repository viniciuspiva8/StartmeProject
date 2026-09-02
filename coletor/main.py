"""
StartMe - Servico de coleta de vagas.

Extrai vagas do portal Companhia de Estagios, persiste no Google Cloud
Firestore e expoe a colecao por uma API HTTP.

Toda a configuracao vem de variaveis de ambiente (ver .env.example).
Nenhum segredo e versionado.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import firebase_admin
import requests
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel

# --------------------------------------------------------------------------
# Configuracao
# --------------------------------------------------------------------------
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-7s %(name)s - %(message)s",
)
log = logging.getLogger("startme.coletor")

CRED_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credenciais.json")
SCRAPER_TOKEN = os.getenv("SCRAPER_TOKEN")
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:5500").split(",") if o.strip()
]
PORTAL_URL = os.getenv("PORTAL_URL", "https://www.ciadeestagios.com.br/vagas-de-estagio/")
PORTAL_BASE = os.getenv("PORTAL_BASE", "https://www.ciadeestagios.com.br")
VAGA_TTL_DIAS = int(os.getenv("VAGA_TTL_DIAS", "30"))
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "20"))
USER_AGENT = os.getenv(
    "USER_AGENT",
    "StartMe-Bot/1.0 (TCC Eng. Computacao - Centro Universitario Fundacao Santo Andre)",
)

if not os.path.exists(CRED_PATH):
    raise RuntimeError(
        f"Credencial do Firebase nao encontrada em '{CRED_PATH}'. "
        "Baixe o JSON da conta de servico e aponte GOOGLE_APPLICATION_CREDENTIALS para ele. "
        "Esse arquivo NUNCA deve ser versionado."
    )

firebase_admin.initialize_app(credentials.Certificate(CRED_PATH))
db = firestore.client()
COLECAO = "vagas"

app = FastAPI(
    title="StartMe - Coletor de Vagas",
    version="0.2.0",
    description="Coleta, armazena e disponibiliza vagas de estagio em TI.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
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


class ResultadoColeta(BaseModel):
    vagas_expiradas_removidas: int
    vagas_novas: int
    vagas_renovadas: int
    cards_encontrados: int


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


@app.get("/api/vagas", response_model=List[Vaga])
def listar_vagas() -> List[Vaga]:
    """Devolve as vagas ativas registradas no Firestore."""
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
            )
        )
    return vagas


# --------------------------------------------------------------------------
# Coleta
# --------------------------------------------------------------------------
def _remover_expiradas(agora: datetime) -> int:
    """Apaga em lote as vagas cuja data de expiracao ja passou."""
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


def _links_existentes() -> Dict[str, str]:
    """Mapa link -> id do documento, lido em uma unica varredura.

    Substitui a consulta por vaga que existia antes (uma leitura do Firestore
    por card processado).
    """
    mapa: Dict[str, str] = {}
    for doc in db.collection(COLECAO).select(["link"]).stream():
        link = (doc.to_dict() or {}).get("link")
        if link:
            mapa[link] = doc.id
    return mapa


def _extrair_cards(html: str) -> List[dict]:
    """Le o HTML do portal e devolve os cards de vaga ainda abertos."""
    sopa = BeautifulSoup(html, "html.parser")
    slider = sopa.find("div", class_="vagas__slider")
    if not slider:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Estrutura do portal mudou: 'div.vagas__slider' nao encontrada.",
        )

    cards = []
    for card in slider.find_all("article", class_="vagas__card"):
        if "--expired" in card.get("class", []):
            continue

        ancora = card.find("a", class_="vagas__card__link")
        href = ancora.get("href") if ancora else None
        if not href:
            continue
        link = href if href.startswith("http") else f"{PORTAL_BASE}{href}"

        titulo_tag = card.find("h2", class_="headline--xs")
        titulo = titulo_tag.get_text(strip=True) if titulo_tag else "Programa de Estagio"

        img = card.find("img", class_="vagas__card__brand__image")
        empresa = (img.get("alt", "") if img else "").replace("Logo ", "").strip()

        cards.append(
            {"link": link, "titulo": titulo, "empresa": empresa or "Companhia de Estagios"}
        )
    return cards


@app.post(
    "/api/coleta",
    response_model=ResultadoColeta,
    dependencies=[Depends(exigir_token)],
)
def executar_coleta() -> ResultadoColeta:
    """Remove vagas expiradas e coleta as vagas abertas do portal."""
    agora = datetime.now(timezone.utc)
    validade = agora + timedelta(days=VAGA_TTL_DIAS)
    hoje = agora.date().isoformat()

    removidas = _remover_expiradas(agora)
    log.info("Limpeza concluida: %s vagas expiradas removidas.", removidas)

    try:
        resposta = requests.get(
            PORTAL_URL, headers={"User-Agent": USER_AGENT}, timeout=HTTP_TIMEOUT
        )
        resposta.raise_for_status()
    except requests.RequestException as erro:
        log.exception("Falha ao acessar o portal.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Portal inacessivel: {erro}",
        ) from erro

    cards = _extrair_cards(resposta.text)
    log.info("Cards abertos encontrados: %s", len(cards))

    conhecidos = _links_existentes()
    lote = db.batch()
    novas = renovadas = pendentes = 0

    for card in cards:
        doc_id = conhecidos.get(card["link"])
        if doc_id:
            lote.update(
                db.collection(COLECAO).document(doc_id),
                {"data_expiracao": validade, "data_ultima_verificacao": hoje},
            )
            renovadas += 1
        else:
            lote.set(
                db.collection(COLECAO).document(),
                {
                    **card,
                    "data_coleta": hoje,
                    "data_ultima_verificacao": hoje,
                    "data_expiracao": validade,
                    "descricao": "Vaga mapeada no portal da Companhia de Estagios.",
                    "salario": "A combinar",
                },
            )
            novas += 1

        pendentes += 1
        if pendentes == 400:
            lote.commit()
            lote = db.batch()
            pendentes = 0

    if pendentes:
        lote.commit()

    log.info("Coleta finalizada: %s novas, %s renovadas.", novas, renovadas)
    return ResultadoColeta(
        vagas_expiradas_removidas=removidas,
        vagas_novas=novas,
        vagas_renovadas=renovadas,
        cards_encontrados=len(cards),
    )
