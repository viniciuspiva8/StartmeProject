"""
StartMe - Extração de requisitos das vagas (título + descrição do anúncio).

Devolve o formato que o motor de match do front consome
(frontend-react/src/lib/match.js; exemplo em src/data/requisitos.js):

    {"obrigatorios": ["Python", "SQL"], "desejaveis": ["Docker"]}

Regras:

* Os nomes canônicos seguem o vocabulário do currículo no front
  (frontend-react/src/data/grade.js): "APIs REST", "Orientação a objetos",
  "Metodologias ágeis", "Testes"... O match compara termo a termo, sem acento e
  sem caixa: "REST API" nunca casaria com "APIs REST". O teste
  tests/test_requisitos.py confere que toda habilidade da grade é conhecida aqui.
* Zonas da descrição: começa obrigatória; depois de "Diferenciais", "Desejável",
  "É um plus", "Não é obrigatório"... vira desejável; um novo "Requisitos" ou
  "Obrigatório" volta a ser obrigatória. O título conta como obrigatório. Um
  termo citado nas duas zonas fica só em obrigatórios.
* Roda na leitura (GET /api/vagas), sobre o título e a descrição já gravados:
  melhorar este arquivo vale para todas as vagas na hora, sem nova coleta (que
  gastaria cota da SerpApi). Nada disto é gravado no Firestore.
* Só reconhece o que está no vocabulário; o resto não entra na conta. Sem nenhum
  obrigatório reconhecido, o front mostra "sem dados para avaliar".
* Fronteira de termo com (?<![a-z0-9]) e (?![a-z0-9]) em vez de \\b, que falha
  depois de "#", "+" e "." (C#, C++, .NET).
"""
import re
import unicodedata
from typing import Dict, List, Optional, Pattern, Tuple

LIMITE_POR_LISTA = 15

# Termo canônico -> padrões (regex sobre o texto sem acento e em minúsculas).
# O primeiro bloco são as habilidades da grade, com a mesma grafia do front.
_VOCABULARIO: List[Tuple[str, List[str]]] = [
    # --- habilidades da grade (frontend-react/src/data/grade.js) ---
    ("Lógica de programação", [r"logica de programacao", r"logica de prog"]),
    ("Informática básica", [r"informatica basica", r"pacote office", r"microsoft office", r"office 365",
                            r"conhecimentos? (?:basicos? )?(?:em|de) informatica"]),
    ("Estruturas de dados", [r"estruturas? de dados"]),
    ("Orientação a objetos", [r"orientac(?:ao|oes) a objetos?", r"orientad[ao]s? a objetos?", r"poo", r"oop",
                              r"object[- ]oriented"]),
    ("Banco de dados relacional", [r"bancos? de dados(?! nao relaciona| nosql)", r"bases? de dados",
                                   r"modelagem de dados", r"modelagem relacional", r"sgbds?"]),
    ("SQL", [r"sql", r"mysql", r"postgres(?:ql)?", r"sqlite", r"mariadb"]),
    ("APIs REST", [r"rest(?:ful)?", r"apis?", r"postman"]),
    ("Testes", [r"testes? (?:de software|unitarios?|automatizados?|de integracao|integrad[oa]s?|e2e|"
                r"end[- ]to[- ]end|funcionais|manuais|de regressao|de sistemas?|de api|de carga|de performance)",
                r"(?:escrever|criar|criacao de|executar|execucao de|realizar|desenvolver) testes",
                r"automacao de testes", r"tdd", r"bdd", r"qa", r"quality assurance", r"garantia d[ae] qualidade",
                r"pytest", r"junit", r"jest", r"cypress", r"selenium", r"playwright"]),
    ("Git", [r"git", r"github", r"gitlab", r"bitbucket", r"versionamento", r"controle de versao"]),
    ("CI/CD", [r"ci ?/ ?cd", r"integracao continua", r"entrega continua", r"deploy continuo",
               r"pipelines? (?:de )?(?:ci|cd|deploy)", r"github actions", r"gitlab ci", r"jenkins", r"devops"]),
    ("Docker", [r"docker", r"conteineres?", r"containers?", r"conteinerizacao"]),
    ("Linux", [r"linux", r"ubuntu", r"debian", r"red ?hat", r"centos", r"shell script", r"bash"]),
    ("Redes", [r"redes? de computadores", r"infraestrutura de redes?", r"administracao de redes?",
               r"redes? (?:lan|wan|corporativas?)", r"(?:analista|tecnico|estagio|estagiari[oa]) (?:de|em) redes?",
               r"protocolos? de rede", r"tcp ?/ ?ip", r"lan", r"wan", r"vpn", r"firewall", r"roteadores?",
               r"switch(?:es)?", r"ccna", r"cabeamento"]),
    ("Cloud", [r"cloud", r"nuvem", r"aws", r"amazon web services", r"azure", r"gcp", r"google cloud"]),
    ("Estatística", [r"estatistica"]),
    ("HTML", [r"html5?"]),
    ("CSS", [r"css3?", r"sass", r"scss", r"tailwind(?:css)?", r"bootstrap"]),
    ("JavaScript", [r"javascript", r"js", r"ecmascript", r"es6"]),
    ("Java", [r"java"]),
    ("Python", [r"python", r"pyspark"]),
    ("C", [r"linguagem c(?![#+])", r"c ?/ ?c\+\+", r"c,? e c\+\+", r"c, c\+\+"]),
    ("Metodologias ágeis", [r"metodologias? ageis", r"metodos ageis", r"praticas ageis", r"desenvolvimento agil",
                            r"times? ageis", r"squads? ageis", r"agile", r"scrum", r"kanban"]),
    # --- outras tecnologias e competências frequentes nos anúncios ---
    ("TypeScript", [r"typescript"]),
    ("React", [r"react(?:\.?js)?(?![ -]?native)"]),
    ("React Native", [r"react[ -]?native"]),
    ("Angular", [r"angular(?:\.?js)?"]),
    ("Vue.js", [r"vue(?:\.?js)?"]),
    ("Next.js", [r"next\.?js"]),
    ("Node.js", [r"node(?:\.?js)?"]),
    ("C#", [r"c#", r"c ?sharp"]),
    (".NET", [r"\.net(?: core| framework)?", r"asp\.net", r"vb\.net", r"dotnet", r"net core"]),
    ("C++", [r"c\+\+", r"cpp"]),
    ("PHP", [r"php"]),
    ("Laravel", [r"laravel"]),
    ("Ruby", [r"ruby"]),
    ("Go", [r"golang", r"linguagem go"]),
    ("Kotlin", [r"kotlin"]),
    ("Swift", [r"swift"]),
    ("Flutter", [r"flutter"]),
    ("Delphi", [r"delphi"]),
    ("COBOL", [r"cobol"]),
    ("VBA", [r"vba"]),
    ("Django", [r"django"]),
    ("Flask", [r"flask"]),
    ("FastAPI", [r"fast ?api"]),
    ("Spring", [r"spring(?: ?boot)?"]),
    ("NoSQL", [r"nosql", r"nao relaciona(?:l|is)"]),
    ("MongoDB", [r"mongo(?:db)?"]),
    ("Redis", [r"redis"]),
    ("Firebase", [r"firebase", r"firestore"]),
    ("Kubernetes", [r"kubernetes", r"k8s"]),
    ("Excel", [r"excel"]),
    ("Power BI", [r"power ?bi"]),
    ("Tableau", [r"tableau"]),
    ("Pandas", [r"pandas"]),
    ("Apache Spark", [r"spark", r"pyspark"]),
    ("Airflow", [r"airflow"]),
    ("ETL", [r"etl"]),
    ("Machine Learning", [r"machine learning", r"aprendizado de maquina", r"deep learning"]),
    ("Inteligência artificial", [r"inteligencia artificial", r"llms?"]),
    ("SAP", [r"sap"]),
    ("Salesforce", [r"salesforce"]),
    ("Jira", [r"jira"]),
    ("Figma", [r"figma"]),
    ("Hardware", [r"hardware", r"perifericos", r"impressoras?",
                  r"manutencao de (?:computadores|micros|maquinas|equipamentos|notebooks|desktops)",
                  r"montagem (?:e manutencao )?de (?:computadores|micros)"]),
    ("Suporte técnico", [r"suporte tecnico", r"help ?desk", r"service ?desk", r"suporte de ti",
                         r"(?:suporte|atendimento) (?:a|ao|aos) usuarios?", r"(?:analista|tecnico) de suporte",
                         r"suporte n[123]", r"suporte de (?:[12]o?|primeiro|segundo) nivel"]),
    ("Gestão de projetos", [r"gest(?:ao|or) de projetos", r"gerenciamento de projetos", r"pmbok", r"pmo"]),
    ("Inglês", [r"ingles", r"english"]),
]

_TERMOS: List[Tuple[str, Pattern[str]]] = [
    (termo, re.compile(r"(?<![a-z0-9])(?:" + "|".join(padroes) + r")(?![a-z0-9])"))
    for termo, padroes in _VOCABULARIO
]

# Mudança de zona na descrição. "Não é obrigatório" é desejável: a marca de obrigatório
# que cai dentro de uma de desejável é descartada.
_MARCA_DESEJAVEL = re.compile(
    r"(?<![a-z0-9])(?:diferencia(?:l|is)|desejave(?:l|is)|um (?:plus|bonus)|nice[- ]to[- ]have|"
    r"nao (?:e |sera )?(?:obrigatori[oa]s?|exigid[oa]s?|necessari[oa]s?))(?![a-z0-9])"
)
_MARCA_OBRIGATORIA = re.compile(
    r"(?<![a-z0-9])(?:requisitos?|obrigatori[oa]s?|imprescindive(?:l|is)|exigid[oa]s?)(?![a-z0-9])"
)


def _normalizar(texto: Optional[str]) -> str:
    decomposto = unicodedata.normalize("NFKD", texto or "")
    sem_acento = "".join(c for c in decomposto if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sem_acento.lower())


def _marcas(texto: str) -> List[Tuple[int, bool]]:
    """Onde a descrição muda de zona: (posição, é desejável), em ordem."""
    desejaveis = [(m.start(), m.end()) for m in _MARCA_DESEJAVEL.finditer(texto)]
    marcas = [(inicio, True) for inicio, _ in desejaveis]
    for m in _MARCA_OBRIGATORIA.finditer(texto):
        if not any(inicio <= m.start() < fim for inicio, fim in desejaveis):
            marcas.append((m.start(), False))
    return sorted(marcas)


def _desejavel_em(marcas: List[Tuple[int, bool]], posicao: int) -> bool:
    estado = False
    for inicio, desejavel in marcas:
        if inicio > posicao:
            break
        estado = desejavel
    return estado


def _em_ordem(posicoes: Dict[str, int]) -> List[str]:
    return sorted(posicoes, key=lambda termo: posicoes[termo])[:LIMITE_POR_LISTA]


def extrair_requisitos(titulo: Optional[str], descricao: Optional[str]) -> Dict[str, List[str]]:
    """Requisitos obrigatórios e desejáveis da vaga, na ordem em que aparecem no anúncio."""
    titulo_n, descricao_n = _normalizar(titulo), _normalizar(descricao)
    marcas = _marcas(descricao_n)
    obrigatorios: Dict[str, int] = {}
    desejaveis: Dict[str, int] = {}
    for termo, padrao in _TERMOS:
        no_titulo = padrao.search(titulo_n)
        if no_titulo:
            obrigatorios[termo] = no_titulo.start() - len(titulo_n) - 1  # o título vem antes da descrição
            continue
        primeira_desejavel = None
        for m in padrao.finditer(descricao_n):
            if not _desejavel_em(marcas, m.start()):
                obrigatorios[termo] = m.start()
                break
            if primeira_desejavel is None:
                primeira_desejavel = m.start()
        else:
            if primeira_desejavel is not None:
                desejaveis[termo] = primeira_desejavel
    return {"obrigatorios": _em_ordem(obrigatorios), "desejaveis": _em_ordem(desejaveis)}
