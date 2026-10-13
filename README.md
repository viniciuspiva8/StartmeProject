# StartMe

Plataforma web de empregabilidade para discentes de Tecnologia da Informação do
Centro Universitário Fundação Santo André. Trabalho de Conclusão de Curso de
Engenharia de Computação — Grupo 15, 2026.

## Para a equipe de TI da FSA: como ligar o StartMe ao sistema acadêmico

Esta seção é para quem vai integrar o StartMe à faculdade. Resumo: **a aplicação não muda**; a faculdade informa
uma fonte de vínculo e um login, e a configuração do serviço aponta para eles. Somente alunos da FSA com vínculo
**ativo** no sistema acadêmico entram.

### Como funciona o controle de acesso

1. O aluno se identifica pelo login institucional da FSA (OpenID Connect) ou pela fonte que a FSA indicar.
2. O StartMe consulta o **vínculo** dele na fonte acadêmica: ativo ou não, curso e semestre. Nada além disso.
3. Sem vínculo, ou com vínculo inativo (trancado, cancelado), o acesso é **recusado** (403).
4. Se a fonte não responder, o acesso é **recusado** (503). O sistema falha fechado, nunca aberto.
5. Nenhum CPF é guardado em claro, enviado a outro serviço ou exibido inteiro. A tela mostra `***.456.789-**`.

### O que a FSA precisa fornecer

| Item | Para quê | Formato esperado |
|---|---|---|
| **Login institucional** (OpenID Connect) | identificar o aluno | `issuer`, `client_id`, `client_secret`, e um claim com o CPF no token (padrão `cpf`) |
| **Fonte de vínculo** | saber se o aluno está ativo, curso e semestre | **uma** das duas opções abaixo |
| Opção A: view somente leitura no banco | consulta SQL com `:cpf` | colunas `nome, curso, semestre, ativo` |
| Opção B: API REST | `GET {url}/{cpf}/vinculo` com chave de API | JSON que o StartMe mapeia com `ACADEMICO_HTTP_MAPA` |

Com a opção B, o formato da resposta da FSA não precisa ser igual ao do StartMe: basta informar onde estão os campos
(exemplo na seção "Variáveis"). Detalhes para a conversa com a TI: `docs/ADOCAO-FSA.md`.

### Variáveis que mudam na adoção

Todas são configuradas no serviço (Cloud Run, variáveis de ambiente). Segredos ficam no Secret Manager.

| Variável | Valor na entrega | Observação |
|---|---|---|
| `AUTH_MODE` | `oidc` (ou `http`) | `demo` não é permitido na entrega |
| `ACADEMICO_PROVIDER` | `sql` (ou `http`) | `arquivo` não é permitido na entrega |
| `OIDC_ISSUER` | URL do IdP da FSA | https |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | fornecidos pela FSA | segredo no Secret Manager |
| `OIDC_REDIRECT_URI` | `https://<site>/api/auth/oidc/retorno` | a FSA deve autorizar esta URL |
| `OIDC_CPF_CLAIM` | nome do claim com o CPF (padrão `cpf`) | |
| `ACADEMICO_SQL_URL` | conexão somente leitura à view | **usuário de banco só leitura**, sem permissão de escrita |
| `ACADEMICO_SQL_CONSULTA` | `SELECT nome, curso, semestre, (situacao='ATIVO') AS ativo FROM <view> WHERE cpf = :cpf` | ajustar à view real |
| `ACADEMICO_HTTP_URL` | `https://<api-fsa>/alunos/{cpf}/vinculo` | https obrigatório |
| `ACADEMICO_HTTP_CABECALHOS` | `{"X-API-Key":"..."}` | chave fornecida pela FSA |
| `ACADEMICO_HTTP_MAPA` | onde estão `curso`, `semestre`, `ativo` na resposta | JSON |
| `ACADEMICO_CPF_FORMATO` | `digitos` (padrão) ou `pontuado` | o formato que a FSA espera |
| `SESSAO_SEGREDO`, `CPF_PEPPER` | gerados pela equipe do StartMe | 32+ bytes aleatórios; **não** são da FSA |
| `SIMULADO` | `false` | tira a faixa "ambiente simulado" da tela de entrada |

### Modo apresentação × modo de entrega (a trava)

O serviço tem uma trava que impede subir em configuração de demonstração por engano.

- **Modo apresentação** (hoje, em produção): `MODO_DEMONSTRACAO=true`. Aceita o login de demonstração e a fonte
  com alunos **fictícios**. Não deve atender alunos reais.
- **Modo de entrega**: a variável `MODO_DEMONSTRACAO` **não existe** no serviço. Sem ela, o serviço só sobe com login
  institucional e fonte da faculdade. Se a configuração ainda estiver em demonstração, o serviço não inicia e a
  mensagem de erro diz o que ajustar.

**Para sair do modo apresentação, a única mudança é remover `MODO_DEMONSTRACAO` do serviço** (e configurar as
variáveis da tabela acima). Nenhum código precisa ser alterado. Para conferir o modo ativo, consulte
`GET /api/publico/config`, que devolve `modo_demonstracao`.

### Checklist de entrega

1. Receber da FSA: login institucional (cliente, segredo, issuer, claim do CPF) e a fonte de vínculo.
2. Pedir a autorização da URL de retorno `https://<site>/api/auth/oidc/retorno` no IdP.
3. Criar `SESSAO_SEGREDO` e `CPF_PEPPER` no Secret Manager (aleatórios, 32+ bytes).
4. Configurar as variáveis da tabela, **sem** `MODO_DEMONSTRACAO`.
5. Validar com um aluno de teste da FSA:
   `python -m integracao.cli doctor --cpf <CPF de teste>` (não imprime dados pessoais).
   Confirmar: vínculo ativo entra; trancado é recusado; CPF inexistente é recusado.
6. Remover a faixa de ambiente simulado (`SIMULADO=false`).
7. Criar o primeiro administrador: `python -m integracao.cli admin-criar --email <e-mail>` (a senha é pedida no terminal).
8. Conferir `GET /api/publico/config`: `modo_demonstracao` deve ser `false`.

### Pontos de atenção

- **Não ative a fonte de arquivo com alunos reais.** Ela contém alunos fictícios; a trava existe para impedir isso.
- **Usuário de banco somente leitura.** A validação da consulta SQL barra comandos de escrita comuns, mas não é uma
  barreira completa. A proteção real é a permissão do usuário no banco.
- **Dados guardados pelo StartMe:** consentimento (versionado), currículo e marcações do aluno, auditoria sem dados
  pessoais e contas de administradores (senha em argon2). O vínculo acadêmico não é gravado: fica só na sessão.
- **Revogação e exclusão:** o aluno revoga o consentimento (apaga currículo e marcações) ou apaga a conta (apaga tudo).
- **Limitações conhecidas** (detalhes em `docs/ADOCAO-FSA.md`): o login institucional não fica amarrado ao navegador
  (risco de CSRF de login, baixo para este uso); um papel de administrador revogado vale até 2 horas; o limite de
  tentativas de login é por instância.
- **Demonstração e testes:** `simulador-fsa/` tem uma faculdade falsa com dados fictícios para testar a integração antes
  da FSA. Não é para a internet.

### Onde está cada coisa

- `docs/ADOCAO-FSA.md`: conversa com a TI, modos lado a lado e checklist detalhado.
- `docs/SERVIDOR-FALSO-FSA.md`: a simulação e o que trocar por ser real.
- `coletor/integracao/config.py`: a trava e a leitura das variáveis.
- `e2e/`: teste de ponta a ponta dos três modos (rodado no GitHub Actions).

---

## Baseline do projeto

O código do StartMe existia em duas pastas separadas e sem versionamento comum.
Em 02/09/2026 as duas foram consolidadas neste repositório:

| Módulo | Origem | Papel |
|---|---|---|
| `coletor/` | pasta "MVP" | **Tronco do projeto.** Python + FastAPI, coleta vagas de estágio, trainee e júnior em TI pela SerpApi (Google Jobs) e persiste no Google Cloud Firestore. É o módulo que implementa a arquitetura descrita na monografia. |
| `cadastro/` | pasta "startme-projeto-v1" | Node.js + Express sobre MySQL. Modelo relacional de Instituição, Curso, Aluno, Empresa e Vaga. |

Os dois módulos juntos materializam a **persistência poliglota** (Sadalage;
Fowler, 2013) que a monografia justifica: dados de vagas são voláteis e de
esquema variável, e ficam no Firestore; dados cadastrais acadêmicos têm
integridade referencial, e ficam no relacional.

## Estrutura

```
coletor/              serviço de coleta (Python / FastAPI / Firestore)
  main.py             rotas da API e limpeza de vagas expiradas
  fontes/serpapi.py   fonte de vagas: busca, filtro, normalização, cota e upsert
  tests/              testes pytest (sem rede; fixture de resposta real da SerpApi)
  Dockerfile          imagem de execução
  .env.example        configuração de referência
frontend-react/       interface do aluno e painel do administrador (React 18 + Vite + Tailwind); ver frontend-react/README.md
simulador-fsa/        faculdade simulada (Postgres, API e IdP fictícios) para testar a integração; ver simulador-fsa/README.md
e2e/                  teste de ponta a ponta do plug-and-play nos três modos (navegador de verdade)
integracao/           (dentro de coletor/) camada de integração acadêmica: CPF, sessão, provedores e login da FSA
design-reference/     protótipo de design de origem (StartMe.dc.html) e mapa de telas
docs/
  arquitetura/        topologia e documentação do MVP
  historico/          rascunhos antigos, mantidos só como referência
```

## Como rodar

### Coletor

```bash
cd coletor
cp .env.example .env            # preencha SCRAPER_TOKEN, SERPAPI_KEY e o caminho da credencial
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --env-file .env
```

A credencial da conta de serviço do Firebase (`credenciais.json`) **não é
versionada**. Baixe do console do Firebase e aponte
`GOOGLE_APPLICATION_CREDENTIALS` para ela. O mesmo vale para `SERPAPI_KEY`: só
por variável de ambiente, nunca em código (a chave vai na query string das
chamadas, então o coletor redige qualquer `api_key` antes de logar).

Rotas:

| Método | Rota | Autenticação |
|---|---|---|
| GET | `/health` | — |
| GET | `/api/vagas` | — |
| POST | `/api/coleta` | header `X-Scraper-Token` |

`GET /api/vagas` devolve `id, titulo, empresa, link, data_coleta, descricao,
salario` e, como campos extras, `fonte` e `via` (portal onde o Google achou a vaga).

**Fonte de vagas: SerpApi.** `POST /api/coleta` remove as vagas expiradas e roda
`SERPAPI_QUERIES` × `SERPAPI_LOCALIZACOES` (até `SERPAPI_MAX_PAGINAS` páginas
cada). Entram só vagas de **estágio, trainee e júnior** (regra em
`fontes/serpapi.py`, constantes `REGRA_*`; "aprendiz" e níveis pleno/sênior ficam
fora). O upsert usa o `htidocid` do Google (o `job_id` muda a cada busca). Uma
execução faz no máximo `SERPAPI_MAX_BUSCAS_EXEC` (16) buscas, e o contador mensal
(coleção `controle_serpapi`) bloqueia novas chamadas ao atingir
`SERPAPI_LIMITE_MENSAL` (240 do plano gratuito de 250). Falha ou cota esgotada
não derrubam a rota: o motivo vem em `serpapi.erro` na resposta. Falhas transitórias
(rede, timeout de `SERPAPI_TIMEOUT`, 5xx) têm 1 nova tentativa; se persistirem, só aquela
busca é pulada e as demais seguem (3 falhas seguidas interrompem). Chave inválida (401/403)
e limite de taxa (429) param tudo na hora. O contador local conta também buscas repetidas
que o SerpApi serviu do cache (grátis), então marca um pouco acima do uso real.

**Região.** Só entram vagas de São Paulo (capital e zonas) e do Grande ABC (Santo
André, São Bernardo do Campo, São Caetano do Sul, Diadema, Mauá, Ribeirão Pires e
Rio Grande da Serra), conferidas pelo campo `location` do Google (lista
`CIDADES_ALVO`). Vagas remotas ("Qualquer lugar") ficam de fora, a menos que
`SERPAPI_ACEITAR_REMOTO=true`. Salários em "mil" (`R$ 2 mil`) são gravados como
número (`R$ 2.000`), formato que o frontend lê corretamente.

**Logo da empresa.** O Google Jobs traz um `thumbnail` (56 px) em parte das vagas.
O coletor baixa a imagem e grava na vaga como data URI no campo `logo` de
`GET /api/vagas`, então o navegador do aluno não depende da SerpApi, e a imagem
não expira. Só baixa de `serpapi.com`, só aceita PNG/JPEG/GIF/WebP (nunca SVG, por
assinatura de bytes), limita o tamanho a 20 KB e descarta o ícone cinza genérico
de "sem logo" do Google. Sem logo, o campo vai vazio e a interface mostra a letra
da empresa. Baixar a imagem não gasta a cota de buscas.

**CORS.** Lista explícita em `ALLOWED_ORIGINS` (nunca `*`; barra final é removida).
O padrão cobre o Vite (`5173` dev, `4173` preview) e o Live Server (`5500`), em
`localhost` e `127.0.0.1`, e vale para o coletor e para o `cadastro`. Em produção,
defina só o domínio real do frontend.

**Rodar localmente sem Firebase.** O `docker-compose.local.yml` sobe o coletor
junto de um emulador do Firestore (nada vai para o Firebase real, sem
`credenciais.json`):

```bash
cd coletor
cp .env.example .env            # preencha SERPAPI_KEY e SCRAPER_TOKEN
docker compose -f docker-compose.local.yml up --build -d
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/coleta -H "X-Scraper-Token: $SCRAPER_TOKEN"
docker compose -f docker-compose.local.yml down      # os dados do emulador somem
```

Os padrões buscam em São Paulo (a busca na capital cobre todas as zonas) e nas 7 cidades do
Grande ABC: 2 consultas × 8 localidades = **16 buscas por coleta**. Isso não cabe em coleta
diária (16 × 30 = 480, contra 240 de teto mensal): rode no máximo 2 vezes por semana
(~128 buscas/mês) ou menos. Para
testar gastando 1, defina `SERPAPI_QUERIES` e `SERPAPI_LOCALIZACOES` com um único
valor. Fora do compose, `FIRESTORE_EMULATOR_HOST` também ativa o emulador;
em produção essa variável deve estar ausente.

**Cache de `GET /api/vagas`.** A lista fica em memória por `VAGAS_CACHE_TTL` segundos (padrão 120),
então uma rajada de requisições custa uma única leitura do Firestore (ADR-001: a cota gratuita é de
50 mil leituras por dia, e sem cache cada requisição lê a coleção inteira). Uma coleta invalida o cache;
se o Firestore falhar (rede, cota), serve a cópia vencida. Os cabeçalhos `X-Cache` (HIT, MISS ou STALE) e
`Cache-Control` permitem medir o efeito nos ensaios de carga.

**Conectar ao Firestore real** (passos que só quem tem a conta pode fazer):

1. No [console do Firebase](https://console.firebase.google.com), crie um projeto (de preferência na
   conta do grupo) e ative o **Firestore** em modo de produção, região `southamerica-east1`, no plano
   gratuito (sem faturamento).
2. Em *Configurações do projeto → Contas de serviço → Gerar nova chave privada*, salve o JSON como
   `coletor/credenciais.json`. O arquivo é ignorado pelo git e pelo Docker; **nunca o envie por chat, e-mail ou commit**.
3. Em *Firestore → Regras*, cole o conteúdo de `coletor/firestore.rules` (negar tudo a clientes: só o backend,
   com a conta de serviço, lê e escreve) e publique.
4. Rode o teste de conexão (grava, lê e apaga um documento temporário; deixe `FIRESTORE_EMULATOR_HOST` ausente):

```bash
cd coletor
python scripts/testar_firestore.py     # esperado: "Destino: Firestore REAL | projeto: <id>" e "OK: ..."
```

Em produção, `FIRESTORE_EMULATOR_HOST` deve estar ausente, o `credenciais.json` entra por volume ou segredo
(nunca na imagem) e `ALLOWED_ORIGINS` lista só o domínio real do frontend.

Testes (não chamam a SerpApi nem o Firebase):

```bash
pip install -r requirements-dev.txt
pytest
```

Com Docker:

```bash
docker build -t startme-coletor coletor/
docker run --env-file coletor/.env \
  -v "$(pwd)/coletor/credenciais.json:/app/credenciais.json:ro" \
  -p 8000:8000 startme-coletor
```

A interface em `coletor/web/` é estática. Ajuste `window.STARTME_API_URL` em
`index.html` conforme o ambiente e sirva a pasta (Live Server ou equivalente).

### Cadastro

```bash
mysql -u root -p < cadastro/database/schema.sql
cd cadastro/backend
cp .env.example .env            # preencha DB_PASSWORD
npm install
npm start
```

Todos os recursos (`empresas`, `instituicoes`, `cursos`, `vagas`, `alunos`)
seguem o mesmo padrão REST: `GET /`, `GET /:id`, `POST /`, `PUT /:id`,
`DELETE /:id`. Há também `GET /health`.

## Documentação de adoção pela FSA

- `docs/ADOCAO-FSA.md`: o que a faculdade precisa fornecer, os três modos (demonstração, SQL e HTTP+OIDC), checklist de adoção, perguntas para a TI e limitações conhecidas.
- `docs/SERVIDOR-FALSO-FSA.md`: como a faculdade simulada funciona e o que trocar para ligar ao sistema real.

## Histórico: frontends anteriores (removidos em 13/10/2026)

Os fronts em HTML/JS puro (`frontend/`, `cadastro/frontend/`, `coletor/web/`) e o backend Node de cadastro (`cadastro/backend/`) foram substituídos pelo React e pela integração. Para consultar o código antigo: `git checkout legado-pre-react`.

<details><summary>Texto original da v1.1 (referência de decisões)</summary>

## Frontend v1.1 (mesclado)

O diretório `frontend/` é uma interface unificada nova, em **HTML/CSS/JS vanilla
(sem framework, sem build step)**, que reimplementa a jornada completa do aluno
a partir do protótipo de design em `design-reference/StartMe.dc.html`. Esse
protótipo foi produzido no formato proprietário do Claude Design (sintaxe
`{{ expr }}` / `sc-if` / `sc-for`, com um runtime injetado por `support.js`) e
só é executável dentro do editor de canvas da Anthropic — não abre em um
navegador comum. `frontend/` é a versão portada dessas 13 pranchas para código
que roda de verdade, preservando o conteúdo em português, os dados mockados e
as notas de decisão de projeto do design original.

Essa decisão — substituir a experiência de listagem de `coletor/web/` por uma
interface única para a jornada do aluno — vem da **Prancha 11** do novo design
("Sistema de design StartMe" / `design-reference/github.md`, linha "Prancha 11
— Sistema de design ... substitui `coletor/web/estilo.css` + Bootstrap"). Os
diretórios legados `cadastro/frontend/` e `coletor/web/` **não foram apagados**
— continuam como referência histórica do projeto.

### O que é real e o que é mockado

| Dado | Origem | Observação |
|---|---|---|
| Vagas coletadas (`id, titulo, empresa, link, data_coleta, descricao, salario`) | `GET {STARTME_COLETOR_URL}/api/vagas` (coletor, Firestore) | Se o coletor responder, os campos acima são reais; se estiver fora do ar (cenário mais provável em ambiente de teste), o frontend cai para o array `VAGAS` mockado em `js/mock-data.js` e sinaliza isso na tela ("Dados de demonstração — coletor indisponível"). |
| Compatibilidade (`modalidade, area, semestreMin, pct, criterios, razao`) | **Inteiramente mockada/derivada no cliente** | Esses campos não existem na coleta real. Quando a coleta real responde, `js/api.js` deriva `area`/`modalidade` por palavra-chave do título e atribui um percentual neutro com aviso explícito; quando cai no mock, usa os valores ilustrativos do design original. A Prancha 6 (`views.js:renderDetalhe`) mantém o aviso "Regra de cálculo pendente de definição pelo time" — é uma pendência real do projeto, não um placeholder a esconder. |
| Dados acadêmicos (nome, curso, semestre, situação do vínculo) | `GET {STARTME_CADASTRO_URL}/alunos/{ID_ALUNO_DEMO}` (cadastro, MySQL) | `ID_ALUNO_DEMO = 1`, constante em `js/config.js` — não há autenticação de usuário final (ver "Pendências conhecidas"), então a Prancha 9 sempre lê um aluno fixo. Se o cadastro estiver fora do ar, cai para `CAMPOS_ACADEMICOS_MOCK` com aviso discreto na tela. |
| Dados de contato (e-mail, telefone, GitHub, LinkedIn, disponibilidade) | **Mock editável, persistido em `localStorage`** (`startme:perfil`) | A tabela `Aluno` do schema relacional não tem colunas para esses campos; não há onde gravá-los de verdade. |
| Minhas candidaturas | **Mock, persistido em `localStorage`** (`startme:candidaturas`) | Não existe endpoint de candidaturas em nenhum backend (ver `design-reference/github.md`). A lista combina uma seed de demonstração com as candidaturas que o usuário cria ao marcar "já me candidatei" na Prancha 6, gerando um protocolo `SM-2026-XXXX`. |
| Currículo e certificados | **100% mock** | Sem backend para isso. Os toggles de "incluir certificado no currículo" são persistidos em `localStorage` (`startme:certificados`) para a demo ficar coerente entre recarregamentos. |
| Login (fundido na Prancha 1, junto do portal) e consentimento (Prancha 3) | **Mock fixo, intencional** | Credenciais de demonstração `123.456.789-00` / `demo2026`. Não é um corte de escopo: o README já lista "Não há autenticação de usuário final em nenhum dos módulos" como pendência conhecida. |

### Como rodar o frontend novo

Nenhum dos dois backends é obrigatório — o frontend funciona 100% com os dados
mock se `coletor` e `cadastro/backend` estiverem fora do ar.

```bash
# opcional, mas recomendado para ver os dados reais de vagas/aluno:
cd coletor && uvicorn main:app --reload            # ver seção "Coletor" acima
cd cadastro/backend && npm start                    # ver seção "Cadastro" acima

# o frontend em si, servido como arquivos estáticos:
npx serve frontend -l 5500
# ou: abra frontend/index.html com a extensão Live Server do VS Code
```

Ajuste `window.STARTME_COLETOR_URL` e `window.STARTME_CADASTRO_URL` no topo de
`frontend/index.html` conforme o ambiente (mesmo padrão de `coletor/web/index.html`).

### Segurança no frontend novo

Segue a mesma prática de `coletor/web/script.js`: todo texto vindo de dado
coletado é escapado (`Api.esc`, em `frontend/js/api.js`) antes de ir para o
DOM, e todo link de origem é validado para aceitar só `http`/`https`
(`Api.linkSeguro`) antes de virar `href`.

</details>

## Segurança

- Nenhum segredo no repositório. Credenciais e senhas vêm de `.env`, que está no `.gitignore`.
- A rota de coleta exige token; sem `SCRAPER_TOKEN` configurado ela responde 503 em vez de operar aberta.
- CORS com lista explícita de origens, sem curinga.
- Conteúdo coletado é escapado antes de ir para o DOM.

## Pendências conhecidas

1. Conferir os Termos de Uso da SerpApi/Google Jobs para o uso acadêmico e registrar a decisão de trocar o scraping direto do portal Companhia de Estágios pela SerpApi (a fonte antiga foi removida do coletor).
2. Não há autenticação de usuário final em nenhum dos módulos.
3. Os dois módulos ainda não se integram: o `cadastro` não conhece as vagas do `coletor`.
4. Não há testes automatizados nem esteira de CI.
5. `ON DELETE CASCADE` no schema relacional apaga Instituição → Curso → Aluno em cascata; confirmar se é o comportamento desejado.
