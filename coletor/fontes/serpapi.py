"""
StartMe - Fonte de vagas: SerpApi (engine google_jobs).

Busca vagas de ESTAGIO, TRAINEE e JUNIOR em TI para Sao Paulo e Grande ABC,
normaliza cada resultado para o formato da colecao "vagas" do Firestore e faz
upsert pelo identificador estavel da vaga no Google.

Pontos de atencao (verificados contra uma resposta real, ver
tests/fixtures/serpapi_google_jobs.json):

* A chave da API vai na query string. Nenhuma URL completa e logada e as
  excecoes do `requests` (que carregam a URL) nunca sao propagadas: so mensagens
  redigidas saem deste modulo.
* `job_id` NAO e estavel: e um base64 de JSON que embute a localizacao da busca
  (`uule`) e um token de sessao (`fc`). A mesma vaga achada por consultas ou
  cidades diferentes tem `job_id` diferente. O identificador estavel e o
  `htidocid` contido nesse JSON, e e ele que usamos como chave de upsert.
* Tipo de vaga, salario e "ha X dias" chegam em `extensions` (lista de textos),
  nao em `detected_extensions`. Os dois formatos sao aceitos.
* Cota: o plano gratuito tem 250 buscas bem-sucedidas por mes. O contador fica
  no Firestore (colecao `controle_serpapi`, um documento por mes).
"""
import base64
import hashlib
import json
import logging
import os
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import requests
from google.cloud.firestore_v1 import Increment
from pydantic import BaseModel

log = logging.getLogger("startme.coletor.serpapi")

SERPAPI_URL = "https://serpapi.com/search.json"
FONTE = "serpapi"
COLECAO_VAGAS = "vagas"
COLECAO_CONTROLE = "controle_serpapi"
LIMITE_DESCRICAO = 1500

# --------------------------------------------------------------------------
# Regra de filtro (estagio, trainee e junior). Os textos sao comparados sem
# acento e em minusculas.
#
#  1. Titulo com termo de nivel acima (pleno, senior...) -> FORA, mesmo que o
#     tipo de vaga diga "Estagio" (o Google rotula errado com frequencia).
#  2. Titulo com estagio / estagiario / intern / trainee / junior / jr -> ENTRA.
#  3. Tipo de vaga (schedule_type ou `extensions`) com estagio / intern /
#     trainee -> ENTRA. Cobre "Tempo integral e Estagio".
#  4. Qualquer outro caso -> FORA. "Aprendiz" (Jovem Aprendiz) nao entra.
# --------------------------------------------------------------------------
REGRA_EXCLUIR_TITULO = re.compile(
    r"\b(pleno|senior|sr|especialista|gerente|coordenador|lider)\b"
)
REGRA_INCLUIR_TITULO = re.compile(
    r"\b(estagio|estagiari[oa]s?|intern(ship)?|trainee|junior|jr)\b"
)
REGRA_INCLUIR_TIPO = re.compile(r"\b(estagio|intern(ship)?|trainee)\b")
_REGRA_SALARIO = re.compile(r"r\$|por\s+(mes|hora|dia|semana|ano)")

# --------------------------------------------------------------------------
# Regiao alvo: cidade de Sao Paulo (e suas zonas) e Grande ABC. O Google devolve
# vagas de cidades vizinhas e de todo o pais em buscas por regiao, entao o
# campo `location` de cada resultado e conferido contra esta lista. Texto sem
# acento, em minusculas, comparado por segmento ("Santo Andre, SP" -> ["santo
# andre", "sp"]), nunca por substring: "Campinas, State of Sao Paulo" nao passa.
# Vagas remotas ("Qualquer lugar") so entram com SERPAPI_ACEITAR_REMOTO=true.
# --------------------------------------------------------------------------
CIDADES_ALVO = frozenset({
    "sao paulo",
    # Grande ABC
    "santo andre", "sao bernardo do campo", "sao caetano do sul",
    "diadema", "maua", "ribeirao pires", "rio grande da serra",
})
_ZONA_SP = re.compile(r"^zona (norte|sul|leste|oeste|central)$")
_REMOTO_LOCAL = frozenset({"qualquer lugar", "anywhere"})
_REMOTO_TEXTO = re.compile(r"trabalho de casa|home office|remoto|remote")

# --------------------------------------------------------------------------
# Logo da empresa (campo `thumbnail` do Google Jobs). O coletor baixa a imagem
# (56 px, ~1 KB) e a grava na vaga como data URI: o navegador do aluno nao
# depende da SerpApi, a imagem nao expira e nenhum terceiro recebe o IP dele.
# So baixa de hosts da lista, so aceita PNG/JPEG/GIF/WebP (nunca SVG) por
# assinatura de bytes, e descarta o icone cinza generico de "sem logo" do Google.
# --------------------------------------------------------------------------
LOGO_HOSTS = frozenset({"serpapi.com", "www.serpapi.com"})
LOGO_MAX_BYTES = 20_000
LOGO_TIMEOUT = 8
# O Google devolve o MESMO icone cinza de predio com bytes diferentes (229 e 278 bytes
# medidos), entao o hash exato nao basta: PNG abaixo de LOGO_PNG_MIN_BYTES tambem e
# tratado como generico. Logos reais de 56 px ficam bem acima disso (>= ~650 bytes).
LOGO_PNG_MIN_BYTES = 400
LOGO_PLACEHOLDERS_SHA1 = frozenset({
    "cd4a613fe9e540f774e4fa1668c957beb2a9f854",  # predio cinza 56x56, variante A (229 bytes)
    "a84077f2e5df9bbe1d9ddf9ccb98d392fe243854",  # predio cinza 56x56, variante B (278 bytes)
})

# Uma busca em "Sao Paulo" cobre a capital inteira (todas as zonas; o SerpApi nao tem
# "Zona Leste" etc. como localizacao). As 7 cidades do Grande ABC ganham busca propria.
LOCALIZACOES_PADRAO = (
    "Sao Paulo,State of Sao Paulo,Brazil",
    "Santo Andre,State of Sao Paulo,Brazil",
    "Sao Bernardo do Campo,State of Sao Paulo,Brazil",
    "Sao Caetano do Sul,State of Sao Paulo,Brazil",
    "Diadema,State of Sao Paulo,Brazil",
    "Maua,State of Sao Paulo,Brazil",
    "Ribeirao Pires,State of Sao Paulo,Brazil",
    "Rio Grande da Serra,State of Sao Paulo,Brazil",
)
MAX_BUSCAS_EXEC_PADRAO = 16  # 2 consultas x 8 localidades x 1 pagina

_REGEX_CHAVE_URL = re.compile(r"(api_key=)[^&\s\"'<>]+", re.IGNORECASE)


# --------------------------------------------------------------------------
# Redacao da chave
# --------------------------------------------------------------------------
def redigir(texto: object, chave: Optional[str] = None) -> str:
    """Troca a chave (e qualquer `api_key=...`) por `***`."""
    saida = _REGEX_CHAVE_URL.sub(r"\1***", str(texto))
    chave = chave or os.getenv("SERPAPI_KEY")
    if chave:
        saida = saida.replace(chave, "***")
    return saida


class RedacaoFiltro(logging.Filter):
    """Filtro de log que redige a chave da SerpApi na mensagem e no traceback."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redigir(record.getMessage())
        record.args = ()
        if record.exc_info:
            record.exc_text = redigir(logging.Formatter().formatException(record.exc_info))
            record.exc_info = None
        elif record.exc_text:
            record.exc_text = redigir(record.exc_text)
        return True


def instalar_redacao_logs() -> None:
    """Aplica a redacao a todos os handlers do root e silencia o urllib3."""
    for handler in logging.getLogger().handlers:
        if not any(isinstance(f, RedacaoFiltro) for f in handler.filters):
            handler.addFilter(RedacaoFiltro())
    logging.getLogger("urllib3").setLevel(logging.WARNING)


log.addFilter(RedacaoFiltro())


# --------------------------------------------------------------------------
# Configuracao
# --------------------------------------------------------------------------
def _lista(valor: Optional[str], padrao: str) -> Tuple[str, ...]:
    bruto = valor if valor and valor.strip() else padrao
    return tuple(p.strip() for p in bruto.split(";") if p.strip())


class Config(BaseModel):
    chave: str = ""
    queries: Tuple[str, ...]
    localizacoes: Tuple[str, ...]
    max_paginas: int = 1
    limite_mensal: int = 240
    aceitar_remoto: bool = False
    # Trava de seguranca: teto de buscas por execucao, qualquer que seja a
    # combinacao consultas x localizacoes x paginas configurada.
    max_buscas_exec: int = MAX_BUSCAS_EXEC_PADRAO
    ttl_dias: int = 30
    timeout: int = 45

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            chave=os.getenv("SERPAPI_KEY", "").strip(),
            queries=_lista(os.getenv("SERPAPI_QUERIES"), "estágio desenvolvedor;vaga júnior TI"),
            localizacoes=_lista(
                os.getenv("SERPAPI_LOCALIZACOES"),
                ";".join(LOCALIZACOES_PADRAO),
            ),
            max_paginas=max(1, int(os.getenv("SERPAPI_MAX_PAGINAS", "1"))),
            limite_mensal=int(os.getenv("SERPAPI_LIMITE_MENSAL", "240")),
            aceitar_remoto=os.getenv("SERPAPI_ACEITAR_REMOTO", "").strip().lower() in ("1", "true", "sim"),
            max_buscas_exec=int(os.getenv("SERPAPI_MAX_BUSCAS_EXEC", str(MAX_BUSCAS_EXEC_PADRAO))),
            ttl_dias=int(os.getenv("VAGA_TTL_DIAS", "30")),
            timeout=int(os.getenv("SERPAPI_TIMEOUT", "45")),
        )


class ResultadoSerpapi(BaseModel):
    buscas_realizadas: int = 0
    resultados_brutos: int = 0
    descartadas_filtro: int = 0
    descartadas_regiao: int = 0
    descartadas_invalidas: int = 0
    vagas_unicas: int = 0
    logos_obtidas: int = 0
    buscas_falhas: int = 0
    vagas_novas: int = 0
    vagas_renovadas: int = 0
    cota_mes_usada: int = 0
    cota_mes_limite: int = 0
    erro: Optional[str] = None


class SerpApiErro(Exception):
    """Falha na SerpApi. A mensagem ja vem sem a chave.

    `fatal`: o erro se repetiria em toda busca (chave invalida, cota, limite de
    taxa), entao nao adianta tentar de novo nem seguir para a proxima busca.
    """

    def __init__(self, mensagem: str, fatal: bool = False):
        super().__init__(mensagem)
        self.fatal = fatal


# Falhas transitorias (rede, timeout, 5xx) tem 1 nova tentativa; se persistirem, a busca
# e pulada e a coleta segue. Abaixo de MAX_FALHAS_SEGUIDAS, uma busca ruim nao derruba as outras.
STATUS_FATAIS = frozenset({401, 403, 429})
TENTATIVAS_POR_BUSCA = 2
ESPERA_ENTRE_TENTATIVAS = 3  # segundos
MAX_FALHAS_SEGUIDAS = 3


# --------------------------------------------------------------------------
# Normalizacao
# --------------------------------------------------------------------------
def _sem_acento(texto: str) -> str:
    decomposto = unicodedata.normalize("NFKD", texto or "")
    return "".join(c for c in decomposto if not unicodedata.combining(c)).lower()


def _textos_extensoes(vaga: dict) -> List[str]:
    detectadas = vaga.get("detected_extensions") or {}
    textos = [str(v) for v in detectadas.values() if isinstance(v, (str, int, float))]
    textos += [str(e) for e in vaga.get("extensions") or []]
    return textos


def classificar(vaga: dict) -> Tuple[bool, str]:
    """Aplica REGRA_* e devolve (aceita, motivo)."""
    titulo = _sem_acento(vaga.get("title") or vaga.get("job_title") or "")
    if REGRA_EXCLUIR_TITULO.search(titulo):
        return False, "nivel_acima"
    if REGRA_INCLUIR_TITULO.search(titulo):
        return True, "titulo"
    tipos = _sem_acento(" ; ".join(_textos_extensoes(vaga)))
    if REGRA_INCLUIR_TIPO.search(tipos):
        return True, "tipo"
    return False, "fora_do_perfil"


def na_regiao(vaga: dict, aceitar_remoto: bool = False) -> bool:
    """True se a vaga e de Sao Paulo (capital e zonas) ou do Grande ABC."""
    local = _sem_acento(vaga.get("location") or "")
    segmentos = [s for s in (p.strip() for p in re.split(r"\s*[,/]\s*|\s+-\s+", local)) if s]
    if any(s in CIDADES_ALVO for s in segmentos):
        return True
    if "sp" in segmentos and any(_ZONA_SP.match(s) for s in segmentos):
        return True
    if aceitar_remoto:
        texto = _sem_acento(" ; ".join(_textos_extensoes(vaga)))
        return bool(_REMOTO_LOCAL.intersection(segmentos) or _REMOTO_TEXTO.search(texto))
    return False


_REGRA_MIL = re.compile(r"(\d+(?:[.,]\d+)?)\s*mil\b", re.IGNORECASE)


def _expandir_mil(texto: str) -> str:
    """"R$ 1,5 mil por mes" -> "R$ 1.500 por mes".

    O frontend le o salario pelos digitos do texto; sem isto, "R$ 2 mil" viraria
    "R$ 2" e a ordenacao por salario ficaria errada.
    """
    def converter(m: "re.Match") -> str:
        valor = float(m.group(1).replace(".", "").replace(",", "."))
        return f"{round(valor * 1000):,}".replace(",", ".")
    return _REGRA_MIL.sub(converter, texto)


def extrair_salario(vaga: dict) -> str:
    detectadas = vaga.get("detected_extensions") or {}
    salario = detectadas.get("salary")
    if not salario:
        for texto in vaga.get("extensions") or []:
            if _REGRA_SALARIO.search(_sem_acento(str(texto))):
                salario = texto
                break
    salario = re.sub(r"\s+", " ", str(salario or "").replace("\xa0", " ")).strip()
    return _expandir_mil(salario) or "A combinar"


def resumir_descricao(texto: str, limite: int = LIMITE_DESCRICAO) -> str:
    """Devolve a descricao inteira se couber; senao, corta no ultimo fim de frase."""
    texto = re.sub(r"[ \t]+", " ", (texto or "").replace("\r\n", "\n")).strip()
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    if len(texto) <= limite:
        return texto

    janela = texto[: limite - 1]
    fim = max(janela.rfind(". "), janela.rfind("! "), janela.rfind("? "), janela.rfind("\n"))
    if fim >= limite // 2:
        corte = janela[: fim + 1]
    else:
        espaco = janela.rfind(" ")
        corte = janela[:espaco] if espaco > 0 else janela
    return corte.rstrip(" ,;:-") + "…"


def _htidocid(vaga: dict) -> Optional[str]:
    """Identificador estavel da vaga no Google, extraido do job_id (ou do share_link)."""
    job_id = vaga.get("job_id")
    if job_id:
        try:
            bruto = base64.urlsafe_b64decode(job_id + "=" * (-len(job_id) % 4))
            achado = json.loads(bruto.decode("utf-8")).get("htidocid")
            if achado:
                return str(achado)
        except (ValueError, UnicodeDecodeError):
            pass
    share = vaga.get("share_link")
    if share:
        valores = parse_qs(urlparse(share).query).get("htidocid")
        if valores:
            return valores[0]
    return job_id or None


def _link(vaga: dict) -> Optional[str]:
    opcoes = vaga.get("apply_options") or []
    candidato = (opcoes[0].get("link") if opcoes else None) or vaga.get("share_link")
    if candidato and urlparse(candidato).scheme in ("http", "https"):
        return candidato
    return None


def normalizar(vaga: dict, hoje: str, validade: datetime) -> Optional[dict]:
    """Converte um item de `jobs_results` em documento da colecao "vagas".

    Devolve None se faltar identificador, titulo ou link utilizavel.
    """
    chave = _htidocid(vaga)
    titulo = (vaga.get("title") or vaga.get("job_title") or "").strip()
    link = _link(vaga)
    if not (chave and titulo and link):
        return None

    return {
        "id": f"serpapi_{hashlib.sha1(chave.encode('utf-8')).hexdigest()}",
        "serpapi_job_id": chave,
        "titulo": titulo,
        "empresa": (vaga.get("company_name") or "").strip() or "Empresa nao informada",
        "link": link,
        "descricao": resumir_descricao(vaga.get("description") or ""),
        "salario": extrair_salario(vaga),
        "fonte": FONTE,
        "via": (vaga.get("via") or "").strip(),
        "logo": "",  # preenchido por _resolver_logos (data URI)
        "_thumbnail": vaga.get("thumbnail") or "",  # auxiliar: nunca vai para o Firestore
        "data_coleta": hoje,
        "data_ultima_verificacao": hoje,
        "data_expiracao": validade,
    }


# --------------------------------------------------------------------------
# Cota mensal (Firestore)
# --------------------------------------------------------------------------
class CotaMensal:
    """Contador de buscas do mes corrente, um documento por mes (AAAA-MM)."""

    def __init__(self, db, limite: int, agora: datetime):
        self.limite = limite
        self._agora = agora
        self._ref = db.collection(COLECAO_CONTROLE).document(agora.strftime("%Y-%m"))

    def usadas(self) -> int:
        snap = self._ref.get()
        return int((snap.to_dict() or {}).get("buscas", 0)) if snap.exists else 0

    def registrar(self) -> None:
        self._ref.set(
            {
                "buscas": Increment(1),
                "limite": self.limite,
                "atualizado_em": self._agora.isoformat(),
            },
            merge=True,
        )


# --------------------------------------------------------------------------
# Chamada HTTP
# --------------------------------------------------------------------------
def _buscar_pagina(cfg: Config, query: str, localizacao: str, token: Optional[str]) -> dict:
    params = {
        "engine": "google_jobs",
        "q": query,
        "location": localizacao,
        "gl": "br",
        "hl": "pt-br",
        "api_key": cfg.chave,
    }
    if token:
        params["next_page_token"] = token
    try:
        resposta = requests.get(SERPAPI_URL, params=params, timeout=cfg.timeout)
    except requests.RequestException as erro:
        # `from None`: a excecao original carrega a URL com a api_key.
        raise SerpApiErro(f"falha de rede ao chamar a SerpApi ({type(erro).__name__})") from None

    try:
        dados = resposta.json()
    except ValueError:
        dados = {}
    if resposta.status_code != 200:
        detalhe = redigir(dados.get("error") or resposta.reason or "sem detalhe", cfg.chave)
        raise SerpApiErro(
            f"SerpApi respondeu HTTP {resposta.status_code}: {detalhe}",
            fatal=resposta.status_code in STATUS_FATAIS,
        )
    return dados


def _buscar_com_retry(cfg: Config, query: str, localizacao: str, token: Optional[str]) -> dict:
    """Uma nova tentativa para falhas transitorias; erros fatais saem na hora.

    Observacao: um timeout do lado de ca pode ter sido executado (e cobrado) pelo
    SerpApi, entao a nova tentativa pode gastar uma busca a mais da cota.
    """
    for tentativa in range(1, TENTATIVAS_POR_BUSCA + 1):
        try:
            return _buscar_pagina(cfg, query, localizacao, token)
        except SerpApiErro as erro:
            if erro.fatal or tentativa == TENTATIVAS_POR_BUSCA:
                raise
            log.warning("Busca falhou (%s); nova tentativa em %ss.", erro, ESPERA_ENTRE_TENTATIVAS)
            time.sleep(ESPERA_ENTRE_TENTATIVAS)
    raise AssertionError("inalcancavel")  # pragma: no cover


def _sem_resultados(dados: dict) -> bool:
    """O Google devolve 200 com `error` quando a busca nao tem nenhum resultado."""
    return "error" in dados and "any results" in str(dados["error"]).lower()


# --------------------------------------------------------------------------
# Logos
# --------------------------------------------------------------------------
def _tipo_da_imagem(corpo: bytes) -> Optional[str]:
    """Tipo MIME pela assinatura dos bytes (nao confia no Content-Type)."""
    if corpo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if corpo.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if corpo.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if corpo[:4] == b"RIFF" and corpo[8:12] == b"WEBP":
        return "image/webp"
    return None


def baixar_logo(url: str) -> Optional[str]:
    """Baixa o thumbnail e devolve um data URI, ou None se nao servir como logo.

    Nunca levanta: sem logo, a interface cai para a letra da empresa.
    """
    partes = urlparse(url or "")
    if partes.scheme != "https" or partes.hostname not in LOGO_HOSTS:
        return None
    try:
        resposta = requests.get(url, timeout=LOGO_TIMEOUT, stream=True)
        if resposta.status_code != 200:
            return None
        corpo = b""
        for pedaco in resposta.iter_content(chunk_size=4096):
            corpo += pedaco
            if len(corpo) > LOGO_MAX_BYTES:
                return None
    except requests.RequestException:
        return None

    tipo = _tipo_da_imagem(corpo)
    if not tipo or hashlib.sha1(corpo).hexdigest() in LOGO_PLACEHOLDERS_SHA1:
        return None
    if tipo == "image/png" and len(corpo) < LOGO_PNG_MIN_BYTES:
        return None  # variante nova do icone generico
    return f"data:{tipo};base64,{base64.b64encode(corpo).decode('ascii')}"


def _resolver_logos(vagas: Dict[str, dict], precisam: List[str]) -> int:
    """Preenche `logo` das vagas em `precisam`. A mesma URL e baixada uma vez so."""
    por_url: Dict[str, Optional[str]] = {}
    obtidas = 0
    for doc_id in precisam:
        url = vagas[doc_id].get("_thumbnail") or ""
        if not url:
            continue
        if url not in por_url:
            por_url[url] = baixar_logo(url)
        if por_url[url]:
            vagas[doc_id]["logo"] = por_url[url]
            obtidas += 1
    return obtidas


# --------------------------------------------------------------------------
# Persistencia
# --------------------------------------------------------------------------
_CAMPOS_ATUALIZAVEIS = ("titulo", "empresa", "link", "descricao", "salario", "via")


def existentes_no_firestore(db, ids: List[str]) -> Dict[str, dict]:
    """Documentos que ja existem na colecao, por id (uma leitura em lote)."""
    colecao = db.collection(COLECAO_VAGAS)
    achados: Dict[str, dict] = {}
    for i in range(0, len(ids), 300):
        refs = [colecao.document(doc_id) for doc_id in ids[i : i + 300]]
        for snap in db.get_all(refs):
            if snap.exists:
                achados[snap.id] = snap.to_dict() or {}
    return achados


def persistir(db, vagas: Dict[str, dict], validade: datetime, hoje: str,
              existentes: Optional[Dict[str, dict]] = None) -> Tuple[int, int]:
    """Upsert por id derivado do htidocid. Nao toca em vagas de outras fontes.

    Vaga nova: grava o documento inteiro. Vaga existente: renova
    `data_expiracao` e `data_ultima_verificacao`, atualiza os campos descritivos
    (o anuncio pode mudar) e preserva `data_coleta`. O `logo` so e sobrescrito
    quando esta coleta obteve um: nunca apaga um logo bom por falha de download.
    """
    if not vagas:
        return 0, 0
    colecao = db.collection(COLECAO_VAGAS)
    if existentes is None:
        existentes = existentes_no_firestore(db, list(vagas))

    lote = db.batch()
    novas = renovadas = pendentes = 0
    for doc_id, dados in vagas.items():
        ref = colecao.document(doc_id)
        if doc_id in existentes:
            atualizados = {k: dados[k] for k in _CAMPOS_ATUALIZAVEIS}
            if dados.get("logo"):
                atualizados["logo"] = dados["logo"]
            lote.update(ref, {**atualizados, "data_expiracao": validade,
                              "data_ultima_verificacao": hoje})
            renovadas += 1
        else:
            lote.set(ref, {k: v for k, v in dados.items() if k != "id" and not k.startswith("_")})
            novas += 1
        pendentes += 1
        if pendentes == 400:  # limite de 500 operacoes por lote no Firestore
            lote.commit()
            lote = db.batch()
            pendentes = 0
    if pendentes:
        lote.commit()
    return novas, renovadas


# --------------------------------------------------------------------------
# Coleta
# --------------------------------------------------------------------------
def coletar(db, cfg: Optional[Config] = None, agora: Optional[datetime] = None) -> ResultadoSerpapi:
    """Executa as buscas configuradas, filtra, deduplica e grava no Firestore.

    Nunca levanta por falha da SerpApi: o motivo vai em `ResultadoSerpapi.erro`
    e o que ja foi coletado e gravado.
    """
    cfg = cfg or Config.from_env()
    agora = agora or datetime.now(timezone.utc)
    hoje = agora.date().isoformat()
    validade = agora + timedelta(days=cfg.ttl_dias)

    cota = CotaMensal(db, cfg.limite_mensal, agora)
    usadas = cota.usadas()
    resultado = ResultadoSerpapi(cota_mes_usada=usadas, cota_mes_limite=cfg.limite_mensal)

    if not cfg.chave:
        resultado.erro = "SERPAPI_KEY nao configurada; fonte SerpApi desabilitada."
        log.warning(resultado.erro)
        return resultado

    plano = [(q, loc) for loc in cfg.localizacoes for q in cfg.queries]
    vagas: Dict[str, dict] = {}
    vistas = set()  # (titulo, empresa) normalizados: o mesmo anuncio sob outro htidocid
    falhas_seguidas = 0
    ultima_falha = ""

    try:
        for consulta, localizacao in plano:
            token: Optional[str] = None
            for pagina in range(1, cfg.max_paginas + 1):
                if resultado.buscas_realizadas >= cfg.max_buscas_exec:
                    log.warning("Teto de %s buscas por execucao atingido.", cfg.max_buscas_exec)
                    raise _Parada("teto de buscas por execucao atingido")
                if usadas >= cfg.limite_mensal:
                    log.warning(
                        "Cota mensal do SerpApi atingida (%s/%s); nenhuma busca feita.",
                        usadas, cfg.limite_mensal,
                    )
                    raise _Parada(f"cota mensal atingida ({usadas}/{cfg.limite_mensal})")

                log.info("SerpApi: busca %s/%s q=%r local=%r pagina=%s",
                         resultado.buscas_realizadas + 1, cfg.max_buscas_exec,
                         consulta, localizacao, pagina)
                try:
                    dados = _buscar_com_retry(cfg, consulta, localizacao, token)
                except SerpApiErro as erro:
                    resultado.buscas_falhas += 1
                    falhas_seguidas += 1
                    ultima_falha = redigir(erro, cfg.chave)
                    log.error("Busca q=%r local=%r falhou: %s", consulta, localizacao, ultima_falha)
                    if erro.fatal or falhas_seguidas >= MAX_FALHAS_SEGUIDAS:
                        raise
                    break  # abandona as paginas desta combinacao e segue para a proxima
                falhas_seguidas = 0

                if not _sem_resultados(dados):
                    em_cache = str((dados.get("search_metadata") or {}).get("status", "")).lower() == "cached"
                    resultado.buscas_realizadas += 1
                    if not em_cache:  # busca em cache e gratuita e nao conta na cota
                        cota.registrar()
                        usadas += 1

                itens = dados.get("jobs_results") or []
                resultado.resultados_brutos += len(itens)
                for item in itens:
                    aceita, _motivo = classificar(item)
                    if not aceita:
                        resultado.descartadas_filtro += 1
                        continue
                    if not na_regiao(item, cfg.aceitar_remoto):
                        resultado.descartadas_regiao += 1
                        continue
                    vaga = normalizar(item, hoje, validade)
                    if vaga is None:
                        resultado.descartadas_invalidas += 1
                        continue
                    duplicata = (_sem_acento(vaga["titulo"]), _sem_acento(vaga["empresa"]))
                    if vaga["id"] in vagas or duplicata in vistas:
                        continue
                    vistas.add(duplicata)
                    vagas[vaga["id"]] = vaga

                token = (dados.get("serpapi_pagination") or {}).get("next_page_token")
                if not token:
                    break
    except _Parada as parada:
        resultado.erro = str(parada)
    except SerpApiErro as erro:
        resultado.erro = redigir(erro, cfg.chave)
        log.error("SerpApi interrompida: %s", resultado.erro)

    if resultado.buscas_falhas and not resultado.erro:
        resultado.erro = (f"{resultado.buscas_falhas} busca(s) falharam e foram puladas; "
                          f"ultima: {ultima_falha}")

    resultado.cota_mes_usada = usadas
    resultado.vagas_unicas = len(vagas)
    # Logo: so para vagas novas ou que ainda nao tem um (a imagem de uma vaga ja
    # gravada nao precisa ser baixada de novo a cada coleta).
    existentes = existentes_no_firestore(db, list(vagas)) if vagas else {}
    precisam = [i for i in vagas if not existentes.get(i, {}).get("logo")]
    resultado.logos_obtidas = _resolver_logos(vagas, precisam)

    resultado.vagas_novas, resultado.vagas_renovadas = persistir(db, vagas, validade, hoje, existentes)
    log.info(
        "SerpApi finalizada: %s buscas, %s brutos, %s unicas (%s novas, %s renovadas, %s logos).",
        resultado.buscas_realizadas, resultado.resultados_brutos, resultado.vagas_unicas,
        resultado.vagas_novas, resultado.vagas_renovadas, resultado.logos_obtidas,
    )
    return resultado


class _Parada(Exception):
    """Interrompe as buscas sem ser falha da API (teto ou cota)."""
