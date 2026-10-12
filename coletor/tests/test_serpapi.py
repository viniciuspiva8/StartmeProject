"""Testes da fonte SerpApi. Nenhum deles chama a API de verdade: requests e mockado."""
import base64
import json
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest

from fontes import serpapi
from tests.helpers import CHAVE_FALSA, FakeResposta

AGORA = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)
HOJE = AGORA.date().isoformat()
VALIDADE = AGORA + timedelta(days=30)
LOG = "startme.coletor.serpapi"


def config(**extra):
    base = dict(
        chave=CHAVE_FALSA,
        queries=("estágio desenvolvedor",),
        localizacoes=("Sao Paulo,State of Sao Paulo,Brazil",),
    )
    base.update(extra)
    return serpapi.Config(**base)


def por_titulo(resposta, trecho):
    return next(j for j in resposta["jobs_results"] if trecho in j["title"])


# --------------------------------------------------------------------------
# Normalizacao
# --------------------------------------------------------------------------
def test_normaliza_resultado_real(resposta_serpapi):
    vaga_bruta = por_titulo(resposta_serpapi(), "Programação C#")
    vaga = serpapi.normalizar(vaga_bruta, HOJE, VALIDADE)

    assert vaga["id"].startswith("serpapi_") and len(vaga["id"]) == len("serpapi_") + 40
    assert vaga["titulo"] == "Estágio em Programação C#"
    assert vaga["empresa"] == "PEKUS"
    assert vaga["link"] == vaga_bruta["apply_options"][0]["link"]
    assert vaga["salario"] == "R$ 2.000 por mês"  # NBSP vira espaco e "mil" vira numero
    assert vaga["fonte"] == "serpapi"
    assert vaga["via"] == "Catho"
    assert vaga["data_coleta"] == HOJE
    assert vaga["data_expiracao"] == VALIDADE
    assert len(vaga["descricao"]) <= serpapi.LIMITE_DESCRICAO


def test_serpapi_job_id_e_o_identificador_estavel_do_google(resposta_serpapi):
    vaga_bruta = por_titulo(resposta_serpapi(), "Programação C#")
    miolo = json.loads(base64.urlsafe_b64decode(vaga_bruta["job_id"] + "=="))
    assert serpapi.normalizar(vaga_bruta, HOJE, VALIDADE)["serpapi_job_id"] == miolo["htidocid"]


@pytest.mark.parametrize("bruto, esperado", [
    ("R$ 1,5 mil por mês", "R$ 1.500 por mês"),
    ("R$ 2 mil por mês", "R$ 2.000 por mês"),
    ("R$ 700 por mês", "R$ 700 por mês"),
    ("R$ 2,5 mil a R$ 3 mil por mês", "R$ 2.500 a R$ 3.000 por mês"),
    ("R$ 15 por hora", "R$ 15 por hora"),
])
def test_salario_em_mil_vira_numero_que_o_frontend_le(bruto, esperado):
    assert serpapi.extrair_salario({"extensions": [bruto]}) == esperado


def test_salario_a_combinar_quando_nao_informado(resposta_serpapi):
    vaga_bruta = por_titulo(resposta_serpapi(), "Visagio Talentos")
    assert serpapi.normalizar(vaga_bruta, HOJE, VALIDADE)["salario"] == "A combinar"


def test_salario_prefere_detected_extensions(resposta_serpapi):
    vaga_bruta = por_titulo(resposta_serpapi(), "Visagio Talentos")
    vaga_bruta["detected_extensions"] = {"salary": "R$ 3 mil por mês"}
    assert serpapi.normalizar(vaga_bruta, HOJE, VALIDADE)["salario"] == "R$ 3.000 por mês"


def test_link_cai_para_share_link_sem_apply_options(resposta_serpapi):
    vaga_bruta = por_titulo(resposta_serpapi(), "Visagio Talentos")
    vaga_bruta["apply_options"] = []
    assert serpapi.normalizar(vaga_bruta, HOJE, VALIDADE)["link"] == vaga_bruta["share_link"]


def test_descarta_vaga_sem_link_utilizavel(resposta_serpapi):
    vaga_bruta = por_titulo(resposta_serpapi(), "Visagio Talentos")
    vaga_bruta["apply_options"] = [{"title": "x", "link": "javascript:alert(1)"}]
    vaga_bruta["share_link"] = ""
    assert serpapi.normalizar(vaga_bruta, HOJE, VALIDADE) is None


def test_descricao_curta_fica_inteira():
    assert serpapi.resumir_descricao("Atribuições de acordo com o cargo.") == "Atribuições de acordo com o cargo."


def test_descricao_longa_e_resumida_em_fim_de_frase():
    texto = " ".join(f"Frase numero {i} da descricao da vaga." for i in range(200))
    resumo = serpapi.resumir_descricao(texto)

    assert len(resumo) <= serpapi.LIMITE_DESCRICAO
    assert resumo.endswith(".…")  # cortou depois de um ponto final, nao no meio da frase
    assert texto.startswith(resumo[:-1])


def test_descricao_longa_sem_pontuacao_corta_em_palavra():
    texto = "palavra " * 500
    resumo = serpapi.resumir_descricao(texto)
    assert len(resumo) <= serpapi.LIMITE_DESCRICAO
    assert resumo.endswith("palavra…")


# --------------------------------------------------------------------------
# Filtro estagio / trainee / junior
# --------------------------------------------------------------------------
@pytest.mark.parametrize(
    "titulo, extensoes, esperado",
    [
        ("Estágio em Desenvolvimento", [], True),
        ("Estagio Desenvolvedor Remoto (PYTHON)", ["Tempo integral"], True),  # sem acento
        ("Estagiária de Dados", [], True),
        ("Software Engineering Intern", [], True),
        ("Programa Trainee Tecnologia", ["Tempo integral"], True),
        ("Desenvolvedor Júnior", ["Tempo integral"], True),
        ("Dev Jr. Backend", [], True),
        ("Backend NodeJS", ["há 1 dia", "Tempo integral e Estágio"], True),  # so pelo tipo
        ("Desenvolvedor backend python sênior", ["Estágio"], False),  # titulo vence o tipo
        ("Analista Pleno de Dados", ["Estágio"], False),
        ("Desenvolvedor Sr", [], False),
        ("Gerente de Estágio", [], False),
        ("Jovem Aprendiz Administrativo", ["Aprendiz"], False),
        ("Desenvolvedor Full Stack", ["Tempo integral"], False),
        ("Analista PL/SQL", [], False),
    ],
)
def test_filtro_estagio_trainee_junior(titulo, extensoes, esperado):
    aceita, _ = serpapi.classificar({"title": titulo, "extensions": extensoes})
    assert aceita is esperado


def test_filtro_aplicado_a_resposta_real(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())

    resultado = serpapi.coletar(fake_db, config(), AGORA)

    assert resultado.resultados_brutos == 10
    assert resultado.descartadas_filtro == 1  # o "sênior"
    assert resultado.descartadas_regiao == 2  # "Qualquer lugar" e Santos
    assert resultado.vagas_unicas == 7
    titulos = {d["titulo"] for d in fake_db.docs("vagas").values()}
    assert not any("sênior" in t for t in titulos)


# --------------------------------------------------------------------------
# Regiao: Sao Paulo (capital e zonas) e Grande ABC
# --------------------------------------------------------------------------
@pytest.mark.parametrize(
    "location, esperado",
    [
        ("São Paulo, SP", True),
        ("São Paulo - SP", True),
        ("Pinheiros, São Paulo - SP", True),
        ("Zona Leste, SP", True),
        ("Zona Sul, SP", True),
        ("Santo André, SP", True),
        ("São Bernardo do Campo, SP", True),
        ("São Caetano do Sul, SP", True),
        ("Diadema, SP", True),
        ("Mauá, SP", True),
        ("Ribeirão Pires, SP", True),
        ("Rio Grande da Serra, SP", True),
        ("Santos, SP", False),
        ("Campinas, SP", False),
        ("Campinas, State of São Paulo, Brazil", False),  # estado nao vale como cidade
        ("Guarulhos, SP", False),
        ("Zona Norte, RJ", False),  # zona so vale com SP
        ("Rio de Janeiro, RJ", False),
        ("Brasil", False),
        ("Qualquer lugar", False),
        ("", False),
    ],
)
def test_filtro_de_regiao(location, esperado):
    assert serpapi.na_regiao({"location": location}) is esperado


def test_remoto_so_entra_quando_habilitado():
    remota = {"location": "Qualquer lugar", "extensions": ["Trabalho de casa", "Estágio"]}
    assert serpapi.na_regiao(remota) is False
    assert serpapi.na_regiao(remota, aceitar_remoto=True) is True
    # remoto habilitado nao libera uma vaga presencial em outra cidade
    assert serpapi.na_regiao({"location": "Santos, SP", "extensions": ["Estágio"]}, aceitar_remoto=True) is False


def test_remoto_habilitado_pelo_ambiente(monkeypatch):
    assert serpapi.Config.from_env().aceitar_remoto is False
    monkeypatch.setenv("SERPAPI_ACEITAR_REMOTO", "true")
    assert serpapi.Config.from_env().aceitar_remoto is True


def test_vagas_de_fora_da_regiao_nao_sao_gravadas(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    serpapi.coletar(fake_db, config(), AGORA)
    empresas = {d["empresa"] for d in fake_db.docs("vagas").values()}
    assert "APPRADIO.PRO" not in empresas  # Santos, SP
    assert "Divulga Vagas" not in empresas  # "Qualquer lugar" (remota)
    assert "AFIC - i9 Empregos" in empresas  # Santo Andre, SP (Grande ABC)
    assert len(empresas) == 7


def test_remoto_habilitado_inclui_a_vaga_remota_da_fixture(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    resultado = serpapi.coletar(fake_db, config(aceitar_remoto=True), AGORA)
    assert resultado.vagas_unicas == 8 and resultado.descartadas_regiao == 1  # so Santos fica de fora


# --------------------------------------------------------------------------
# Persistencia: deduplicacao e upsert
# --------------------------------------------------------------------------
def com_outro_job_id(vaga_bruta):
    """Mesma vaga em outra busca: o job_id muda (uule/fc), o htidocid nao."""
    miolo = json.loads(base64.urlsafe_b64decode(vaga_bruta["job_id"] + "=="))
    miolo["uule"] = "outra-localizacao"
    miolo["fc"] = "outro-token-de-sessao"
    novo = dict(vaga_bruta)
    novo["job_id"] = base64.urlsafe_b64encode(json.dumps(miolo).encode()).decode()
    return novo


def test_deduplica_mesma_vaga_entre_buscas(resposta_serpapi, fake_db, serpapi_http):
    def responder(params):
        dados = resposta_serpapi()
        if params["location"].startswith("Santo"):
            dados["jobs_results"] = [com_outro_job_id(j) for j in dados["jobs_results"]]
        return FakeResposta(dados)

    serpapi_http.responder = responder
    cfg = config(localizacoes=("Sao Paulo,State of Sao Paulo,Brazil", "Santo Andre,State of Sao Paulo,Brazil"))

    resultado = serpapi.coletar(fake_db, cfg, AGORA)

    assert resultado.buscas_realizadas == 2
    assert resultado.resultados_brutos == 20
    assert resultado.vagas_unicas == 7
    assert len(fake_db.docs("vagas")) == 7


def test_upsert_renova_expiracao_sem_duplicar_nem_mexer_em_data_coleta(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())

    primeira = serpapi.coletar(fake_db, config(), AGORA)
    depois = AGORA + timedelta(days=10)
    segunda = serpapi.coletar(fake_db, config(), depois)

    assert (primeira.vagas_novas, primeira.vagas_renovadas) == (7, 0)
    assert (segunda.vagas_novas, segunda.vagas_renovadas) == (0, 7)
    docs = fake_db.docs("vagas")
    assert len(docs) == 7
    um = next(iter(docs.values()))
    assert um["data_coleta"] == HOJE  # preservada
    assert um["salario"] and um["descricao"] is not None
    assert um["data_ultima_verificacao"] == depois.date().isoformat()
    assert um["data_expiracao"] == depois + timedelta(days=30)


def test_renovacao_atualiza_campos_descritivos(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    serpapi.coletar(fake_db, config(), AGORA)
    doc_id, doc = next((i, d) for i, d in fake_db.docs("vagas").items() if d["empresa"] == "PEKUS")
    doc["salario"] = "valor antigo"  # simula um doc gravado com o formato anterior

    serpapi.coletar(fake_db, config(), AGORA + timedelta(days=1))

    assert fake_db.docs("vagas")[doc_id]["salario"] == "R$ 2.000 por mês"


def test_nao_apaga_nem_altera_vagas_de_outras_fontes(resposta_serpapi, fake_db, serpapi_http):
    antiga = {"titulo": "Vaga antiga", "empresa": "X", "link": "https://x", "data_coleta": "2026-09-01",
              "data_expiracao": AGORA + timedelta(days=5)}
    fake_db.collection("vagas").document("doc-antigo").set(dict(antiga))
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())

    serpapi.coletar(fake_db, config(), AGORA)

    assert fake_db.docs("vagas")["doc-antigo"] == antiga
    assert len(fake_db.docs("vagas")) == 8


# --------------------------------------------------------------------------
# Paginacao e teto por execucao
# --------------------------------------------------------------------------
def test_pagina_ate_max_paginas_com_next_page_token(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())

    serpapi.coletar(fake_db, config(max_paginas=2), AGORA)

    assert len(serpapi_http.chamadas) == 2
    assert "next_page_token" not in serpapi_http.chamadas[0]
    assert serpapi_http.chamadas[1]["next_page_token"].startswith("eyJ")


def test_para_de_paginar_quando_nao_ha_proxima_pagina(resposta_serpapi, fake_db, serpapi_http):
    def responder(params):
        dados = resposta_serpapi()
        dados.pop("serpapi_pagination")
        return FakeResposta(dados)

    serpapi_http.responder = responder
    serpapi.coletar(fake_db, config(max_paginas=5), AGORA)
    assert len(serpapi_http.chamadas) == 1


def test_parametros_da_chamada(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    serpapi.coletar(fake_db, config(), AGORA)
    p = serpapi_http.chamadas[0]
    assert (p["engine"], p["gl"], p["hl"]) == ("google_jobs", "br", "pt-br")
    assert p["q"] == "estágio desenvolvedor"
    assert p["location"] == "Sao Paulo,State of Sao Paulo,Brazil"
    assert p["api_key"] == CHAVE_FALSA


def test_trava_de_buscas_por_execucao(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    cfg = config(
        queries=("a", "b", "c"),
        localizacoes=("L1", "L2", "L3"),
        max_paginas=2,  # 3 x 3 x 2 = 18 buscas pedidas
        max_buscas_exec=6,
    )

    resultado = serpapi.coletar(fake_db, cfg, AGORA)

    assert len(serpapi_http.chamadas) == 6
    assert resultado.buscas_realizadas == 6
    assert "teto de buscas" in resultado.erro


def test_configuracao_padrao_cobre_capital_e_todo_o_grande_abc(monkeypatch):
    monkeypatch.setenv("SERPAPI_KEY", CHAVE_FALSA)
    cfg = serpapi.Config.from_env()
    cidades = {loc.split(",")[0] for loc in cfg.localizacoes}
    assert cidades == {
        "Sao Paulo", "Santo Andre", "Sao Bernardo do Campo", "Sao Caetano do Sul",
        "Diadema", "Maua", "Ribeirao Pires", "Rio Grande da Serra",
    }
    # o plano padrao cabe exatamente na trava por execucao, e esta abaixo da cota mensal
    assert len(cfg.queries) * len(cfg.localizacoes) * cfg.max_paginas == cfg.max_buscas_exec == 16
    assert cfg.max_buscas_exec <= cfg.limite_mensal == 240


def test_todas_as_cidades_do_abc_passam_no_filtro_de_regiao():
    for cidade in ("Santo André", "São Bernardo do Campo", "São Caetano do Sul", "Diadema",
                   "Mauá", "Ribeirão Pires", "Rio Grande da Serra"):
        assert serpapi.na_regiao({"location": f"{cidade}, SP"}), cidade
    # bairros e zonas da capital
    for local in ("São Paulo, SP", "Mooca, São Paulo - SP", "Zona Leste, SP", "Zona Oeste, SP"):
        assert serpapi.na_regiao({"location": local}), local


# --------------------------------------------------------------------------
# Cota mensal
# --------------------------------------------------------------------------
def test_contador_mensal_incrementa_a_cada_busca_bem_sucedida(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    cfg = config(queries=("a", "b"))

    resultado = serpapi.coletar(fake_db, cfg, AGORA)

    assert fake_db.docs("controle_serpapi")["2026-10"]["buscas"] == 2
    assert resultado.cota_mes_usada == 2
    # um documento por mes
    serpapi.coletar(fake_db, cfg, datetime(2026, 11, 2, tzinfo=timezone.utc))
    assert fake_db.docs("controle_serpapi")["2026-11"]["buscas"] == 2
    assert fake_db.docs("controle_serpapi")["2026-10"]["buscas"] == 2


def test_nao_chama_a_api_ao_atingir_o_teto_mensal(fake_db, serpapi_http, caplog):
    fake_db.collection("controle_serpapi").document("2026-10").set({"buscas": 240})

    with caplog.at_level(logging.WARNING, logger=LOG):
        resultado = serpapi.coletar(fake_db, config(limite_mensal=240), AGORA)

    assert serpapi_http.chamadas == []
    assert resultado.buscas_realizadas == 0
    assert "cota mensal atingida" in resultado.erro
    assert any(r.levelno == logging.WARNING and "Cota mensal" in r.getMessage() for r in caplog.records)


def test_para_no_meio_quando_a_cota_acaba(resposta_serpapi, fake_db, serpapi_http):
    fake_db.collection("controle_serpapi").document("2026-10").set({"buscas": 238})
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())

    resultado = serpapi.coletar(fake_db, config(queries=("a", "b", "c", "d")), AGORA)

    assert len(serpapi_http.chamadas) == 2
    assert fake_db.docs("controle_serpapi")["2026-10"]["buscas"] == 240
    assert "cota mensal atingida" in resultado.erro
    assert resultado.vagas_unicas == 7  # o que ja foi coletado e gravado


def test_busca_em_cache_ou_sem_resultados_nao_conta(resposta_serpapi, fake_db, serpapi_http):
    em_cache = resposta_serpapi()
    em_cache["search_metadata"]["status"] = "Cached"
    vazia = {"error": "Google hasn't returned any results for this query."}
    respostas = iter([FakeResposta(em_cache), FakeResposta(vazia)])
    serpapi_http.responder = lambda params: next(respostas)

    resultado = serpapi.coletar(fake_db, config(queries=("a", "b")), AGORA)

    assert len(serpapi_http.chamadas) == 2
    assert resultado.erro is None
    assert fake_db.docs("controle_serpapi").get("2026-10", {}).get("buscas", 0) == 0


# --------------------------------------------------------------------------
# Falhas e seguranca da chave
# --------------------------------------------------------------------------
def test_sem_chave_nao_chama_a_api(fake_db, serpapi_http):
    resultado = serpapi.coletar(fake_db, config(chave=""), AGORA)
    assert serpapi_http.chamadas == []
    assert "SERPAPI_KEY" in resultado.erro


def test_falha_de_rede_nao_vaza_a_chave(fake_db, serpapi_http, caplog):
    import requests

    url = f"https://serpapi.com/search.json?engine=google_jobs&api_key={CHAVE_FALSA}"
    serpapi_http.responder = lambda params: requests.ConnectionError(f"Max retries exceeded with url: {url}")

    with caplog.at_level(logging.DEBUG, logger=LOG):
        resultado = serpapi.coletar(fake_db, config(), AGORA)

    assert resultado.erro and "ConnectionError" in resultado.erro
    assert CHAVE_FALSA not in resultado.erro
    assert CHAVE_FALSA not in caplog.text


def test_erro_http_da_api_vem_redigido(fake_db, serpapi_http, caplog):
    corpo = {"error": f"Invalid API key. See https://serpapi.com/manage-api-key?api_key={CHAVE_FALSA}"}
    serpapi_http.responder = lambda params: FakeResposta(corpo, status_code=401, reason="Unauthorized")

    with caplog.at_level(logging.DEBUG, logger=LOG):
        resultado = serpapi.coletar(fake_db, config(), AGORA)

    assert "HTTP 401" in resultado.erro
    assert CHAVE_FALSA not in resultado.erro
    assert CHAVE_FALSA not in caplog.text
    assert resultado.buscas_realizadas == 0  # busca com erro nao conta


def test_falha_no_meio_preserva_o_que_ja_foi_coletado(resposta_serpapi, fake_db, serpapi_http):
    import requests

    def responder(params):
        if params["q"] == "a":
            return FakeResposta(resposta_serpapi())
        return requests.Timeout("lento")

    serpapi_http.responder = responder
    resultado = serpapi.coletar(fake_db, config(queries=("a", "b")), AGORA)

    assert resultado.vagas_novas == 7
    assert resultado.buscas_falhas == 1
    assert "Timeout" in resultado.erro


# --------------------------------------------------------------------------
# Resiliencia: nova tentativa, busca pulada, falha fatal
# --------------------------------------------------------------------------
def test_falha_transitoria_tem_nova_tentativa_e_nao_vira_erro(resposta_serpapi, fake_db, serpapi_http, sem_espera):
    import requests

    respostas = iter([requests.Timeout("lento"), FakeResposta(resposta_serpapi())])
    serpapi_http.responder = lambda params: next(respostas)

    resultado = serpapi.coletar(fake_db, config(), AGORA)

    assert len(serpapi_http.chamadas) == 2  # a original e a nova tentativa
    assert sem_espera == [serpapi.ESPERA_ENTRE_TENTATIVAS]
    assert resultado.erro is None and resultado.buscas_falhas == 0
    assert resultado.vagas_unicas == 7


def test_erro_5xx_tambem_e_tentado_de_novo(resposta_serpapi, fake_db, serpapi_http):
    respostas = iter([FakeResposta({}, status_code=503, reason="Service Unavailable"),
                      FakeResposta(resposta_serpapi())])
    serpapi_http.responder = lambda params: next(respostas)
    resultado = serpapi.coletar(fake_db, config(), AGORA)
    assert resultado.erro is None and resultado.vagas_unicas == 7


def test_uma_busca_que_falha_e_pulada_e_as_demais_seguem(resposta_serpapi, fake_db, serpapi_http):
    import requests

    def responder(params):
        if params["location"].startswith("Diadema"):
            return requests.Timeout("lento")  # sempre falha, mesmo na nova tentativa
        return FakeResposta(resposta_serpapi())

    serpapi_http.responder = responder
    cfg = config(localizacoes=("Sao Paulo,State of Sao Paulo,Brazil", "Diadema,State of Sao Paulo,Brazil",
                               "Santo Andre,State of Sao Paulo,Brazil"))

    resultado = serpapi.coletar(fake_db, cfg, AGORA)

    locais = [c["location"] for c in serpapi_http.chamadas]
    assert locais.count("Diadema,State of Sao Paulo,Brazil") == 2  # tentou e tentou de novo
    assert "Santo Andre,State of Sao Paulo,Brazil" in locais       # a proxima busca rodou
    assert resultado.buscas_realizadas == 2 and resultado.buscas_falhas == 1
    assert resultado.vagas_unicas == 7                             # o que deu certo foi gravado
    assert "1 busca(s) falharam" in resultado.erro and "Timeout" in resultado.erro


def test_localizacao_invalida_http_400_so_pula_aquela_busca(resposta_serpapi, fake_db, serpapi_http):
    def responder(params):
        if params["location"] == "Lugar Inexistente":
            return FakeResposta({"error": "Unsupported location"}, status_code=400, reason="Bad Request")
        return FakeResposta(resposta_serpapi())

    serpapi_http.responder = responder
    cfg = config(localizacoes=("Lugar Inexistente", "Sao Paulo,State of Sao Paulo,Brazil"))
    resultado = serpapi.coletar(fake_db, cfg, AGORA)
    assert resultado.buscas_falhas == 1 and resultado.vagas_unicas == 7


@pytest.mark.parametrize("status", [401, 403, 429])
def test_erro_fatal_para_tudo_sem_nova_tentativa(fake_db, serpapi_http, status):
    serpapi_http.responder = lambda params: FakeResposta({"error": "x"}, status_code=status)
    resultado = serpapi.coletar(fake_db, config(queries=("a", "b", "c")), AGORA)
    assert len(serpapi_http.chamadas) == 1  # nem retry, nem proximas buscas
    assert f"HTTP {status}" in resultado.erro


def test_tres_falhas_seguidas_interrompem_a_coleta(fake_db, serpapi_http):
    import requests

    serpapi_http.responder = lambda params: requests.ConnectionError("fora do ar")
    resultado = serpapi.coletar(fake_db, config(queries=("a", "b", "c", "d", "e")), AGORA)

    assert resultado.buscas_falhas == serpapi.MAX_FALHAS_SEGUIDAS == 3
    assert len(serpapi_http.chamadas) == 3 * serpapi.TENTATIVAS_POR_BUSCA  # nao insiste nas outras 2
    assert "ConnectionError" in resultado.erro


def test_sucesso_zera_a_contagem_de_falhas_seguidas(resposta_serpapi, fake_db, serpapi_http):
    import requests

    def responder(params):
        if params["q"] in ("a", "b", "d", "e"):
            return requests.Timeout("lento")
        return FakeResposta(resposta_serpapi())  # "c" funciona no meio

    serpapi_http.responder = responder
    resultado = serpapi.coletar(fake_db, config(queries=("a", "b", "c", "d", "e")), AGORA)

    assert resultado.buscas_falhas == 4  # nunca 3 seguidas, entao nao interrompeu
    assert {c["q"] for c in serpapi_http.chamadas} == {"a", "b", "c", "d", "e"}


def test_redigir_remove_api_key_de_urls_e_a_chave_literal():
    texto = f"GET https://serpapi.com/search.json?q=x&api_key={CHAVE_FALSA}&hl=pt-br e {CHAVE_FALSA}"
    saida = serpapi.redigir(texto, CHAVE_FALSA)
    assert CHAVE_FALSA not in saida
    assert "api_key=***&hl=pt-br" in saida


def test_filtro_de_log_redige_mensagem_args_e_traceback(caplog):
    logger = logging.getLogger(LOG)
    with caplog.at_level(logging.DEBUG, logger=LOG):
        logger.info("chamando https://serpapi.com/search.json?api_key=%s", "SEGREDO123")
        try:
            raise RuntimeError("falhou em https://serpapi.com/search.json?api_key=SEGREDO123&q=x")
        except RuntimeError:
            logger.error("erro", exc_info=True)
    assert "SEGREDO123" not in caplog.text
    assert "api_key=***" in caplog.text


# --------------------------------------------------------------------------
# Logo da empresa (thumbnail do Google Jobs)
# --------------------------------------------------------------------------
FIXTURES = Path(__file__).parent / "fixtures"
LOGO_INERA = (FIXTURES / "logo_inera.jpg").read_bytes()
PLACEHOLDER = (FIXTURES / "logo_placeholder.png").read_bytes()
URL_OK = "https://serpapi.com/searches/abc/images/x.jpeg"


def thumb(resposta, empresa):
    return next(j for j in resposta["jobs_results"] if j["company_name"] == empresa)["thumbnail"]


def data_uri(corpo, tipo):
    return f"data:{tipo};base64," + base64.b64encode(corpo).decode()


def test_baixar_logo_devolve_data_uri(serpapi_http):
    serpapi_http.imagens[URL_OK] = LOGO_INERA
    assert serpapi.baixar_logo(URL_OK) == data_uri(LOGO_INERA, "image/jpeg")


@pytest.mark.parametrize("arquivo", ["logo_placeholder.png", "logo_placeholder_b.png"])
def test_baixar_logo_descarta_o_icone_generico_do_google(serpapi_http, arquivo):
    # as duas variantes de bytes do MESMO icone de predio, ambas vistas em coletas reais
    serpapi_http.imagens[URL_OK] = (FIXTURES / arquivo).read_bytes()
    assert serpapi.baixar_logo(URL_OK) is None


def test_baixar_logo_descarta_variante_desconhecida_do_icone_generico(serpapi_http):
    # nao esta na lista de hashes, mas e um PNG minusculo: so pode ser o icone liso
    serpapi_http.imagens[URL_OK] = bytes.fromhex("89504e470d0a1a0a") + b"0" * 150
    assert serpapi.baixar_logo(URL_OK) is None


def test_baixar_logo_aceita_png_de_logo_real(serpapi_http):
    png_real = bytes.fromhex("89504e470d0a1a0a") + b"0" * 800
    serpapi_http.imagens[URL_OK] = png_real
    assert serpapi.baixar_logo(URL_OK) == data_uri(png_real, "image/png")


@pytest.mark.parametrize("url", [
    "https://evil.example/logo.png",                   # host fora da lista
    "https://serpapi.com.evil.example/logo.png",       # host parecido
    "http://serpapi.com/images/x.png",                 # sem TLS
    "javascript:alert(1)",
    "",
])
def test_baixar_logo_so_aceita_hosts_da_lista(serpapi_http, url):
    assert serpapi.baixar_logo(url) is None
    assert serpapi_http.downloads == []  # nem tenta a requisicao


@pytest.mark.parametrize("corpo", [
    b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",  # SVG nunca
    b"<html>nao e imagem</html>",
    b"",
    bytes.fromhex("89504e470d0a1a0a") + b"0" * 30_000,  # PNG grande demais
])
def test_baixar_logo_rejeita_conteudo_que_nao_e_logo_valido(serpapi_http, corpo):
    serpapi_http.imagens[URL_OK] = corpo
    assert serpapi.baixar_logo(URL_OK) is None


def test_baixar_logo_nao_confia_no_content_type_so_nos_bytes(serpapi_http):
    # servidor diz que e imagem, mas os bytes sao HTML
    serpapi_http.imagens[URL_OK] = FakeResposta(b"<html></html>")
    assert serpapi.baixar_logo(URL_OK) is None


def test_baixar_logo_falha_de_rede_ou_404_nao_levanta(serpapi_http):
    import requests

    assert serpapi.baixar_logo(URL_OK) is None  # 404 (padrao do espiao)
    serpapi_http.imagens[URL_OK] = requests.ConnectionError("caiu")
    assert serpapi.baixar_logo(URL_OK) is None


def test_coleta_grava_logo_real_e_deixa_vazio_quem_nao_tem(resposta_serpapi, fake_db, serpapi_http):
    base = resposta_serpapi()
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    serpapi_http.imagens[thumb(base, "INERA RESULTADOS HUMANOS")] = LOGO_INERA
    serpapi_http.imagens[thumb(base, "PEKUS")] = PLACEHOLDER  # icone generico: nao vale

    resultado = serpapi.coletar(fake_db, config(), AGORA)

    logos = {d["empresa"]: d["logo"] for d in fake_db.docs("vagas").values()}
    assert logos["INERA RESULTADOS HUMANOS"] == data_uri(LOGO_INERA, "image/jpeg")
    assert logos["PEKUS"] == ""            # placeholder descartado
    assert logos["v(dev)"] == ""           # sem thumbnail: a interface usa a letra
    assert logos["AFIC - i9 Empregos"] == ""  # download falhou (404): idem
    assert resultado.logos_obtidas == 1
    assert resultado.erro is None  # logo nunca derruba a coleta


def test_campos_auxiliares_nao_vao_para_o_firestore(resposta_serpapi, fake_db, serpapi_http):
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    serpapi.coletar(fake_db, config(), AGORA)
    for doc in fake_db.docs("vagas").values():
        assert not any(k.startswith("_") or k == "id" for k in doc)


def test_mesma_thumbnail_e_baixada_uma_vez_so(resposta_serpapi, fake_db, serpapi_http):
    dados = resposta_serpapi()
    url = thumb(dados, "INERA RESULTADOS HUMANOS")
    for vaga in dados["jobs_results"]:
        vaga["thumbnail"] = url  # todas as vagas com o mesmo logo
    serpapi_http.responder = lambda params: FakeResposta(dados)
    serpapi_http.imagens[url] = LOGO_INERA

    resultado = serpapi.coletar(fake_db, config(), AGORA)

    assert serpapi_http.downloads == [url]
    assert resultado.logos_obtidas == resultado.vagas_unicas == 7


def test_nao_baixa_de_novo_logo_de_vaga_que_ja_tem_e_nao_apaga_em_falha(resposta_serpapi, fake_db, serpapi_http):
    base = resposta_serpapi()
    url = thumb(base, "INERA RESULTADOS HUMANOS")
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    serpapi_http.imagens[url] = LOGO_INERA
    serpapi.coletar(fake_db, config(), AGORA)
    serpapi_http.downloads.clear()

    serpapi_http.imagens[url] = FakeResposta(b"", status_code=500)  # agora o download falharia
    serpapi.coletar(fake_db, config(), AGORA + timedelta(days=1))

    assert url not in serpapi_http.downloads  # ja tinha logo: nao tenta de novo
    logos = {d["empresa"]: d["logo"] for d in fake_db.docs("vagas").values()}
    assert logos["INERA RESULTADOS HUMANOS"] == data_uri(LOGO_INERA, "image/jpeg")  # preservado


def test_vaga_sem_logo_tenta_de_novo_na_proxima_coleta(resposta_serpapi, fake_db, serpapi_http):
    base = resposta_serpapi()
    url = thumb(base, "INERA RESULTADOS HUMANOS")
    serpapi_http.responder = lambda params: FakeResposta(resposta_serpapi())
    serpapi.coletar(fake_db, config(), AGORA)  # download falha (404 padrao): fica sem logo

    serpapi_http.imagens[url] = LOGO_INERA
    resultado = serpapi.coletar(fake_db, config(), AGORA + timedelta(days=1))

    logos = {d["empresa"]: d["logo"] for d in fake_db.docs("vagas").values()}
    assert logos["INERA RESULTADOS HUMANOS"] == data_uri(LOGO_INERA, "image/jpeg")
    assert resultado.logos_obtidas == 1
