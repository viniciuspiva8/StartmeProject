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
5. O CPF não é guardado em claro: o que o StartMe guarda é um hash pseudônimo. Ele só vai à fonte da faculdade para a consulta do vínculo, e nunca é exibido inteiro (a tela mostra `***.456.789-**`).

### O que a FSA precisa fornecer

| Item | Para quê | Formato esperado |
|---|---|---|
| **Login institucional** (OpenID Connect) | identificar o aluno | `issuer`, `client_id`, `client_secret`, e um claim com o CPF no token (padrão `cpf`) |
| **Fonte de vínculo** | saber se o aluno está ativo, curso e semestre | **uma** das duas opções abaixo |
| Opção A: view somente leitura no banco | consulta SQL com `:cpf` | colunas `nome, curso, semestre, ativo` |
| Opção B: API REST | `GET` numa URL com `{cpf}` (ex.: `.../alunos/{cpf}/vinculo`), com chave de API | JSON que o StartMe mapeia com `ACADEMICO_HTTP_MAPA` |

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
| `AUTH_HTTP_URL` | só com `AUTH_MODE=http`: endpoint da FSA que valida CPF e senha (`POST`, responde 200 ou 401) | https obrigatório; o caminho recomendado é o `oidc` |
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
5. Validar com um aluno de teste da FSA, na pasta `coletor` e com as mesmas variáveis do serviço:
   `python -m integracao.cli doctor --cpf <CPF de teste>` (não imprime dados pessoais).
   Confirmar: vínculo ativo entra; trancado é recusado; CPF inexistente é recusado.
6. Remover a faixa de ambiente simulado (`SIMULADO=false`).
7. Criar o primeiro administrador: `python -m integracao.cli admin-criar --email <e-mail>` (papel `admin` por padrão,
   ou `--papel leitor`; a senha é pedida no terminal, mínimo de 12 caracteres).
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

## Como o StartMe está montado

```
Navegador ──► Firebase Hosting (front React)
                 │  /api/** e /health são repassados ao Cloud Run (mesma origem)
                 ▼
              Cloud Run "startme-coletor" (Python/FastAPI, southamerica-east1)
                 ├─ coleta de vagas (SerpApi) ◄── Cloud Scheduler: terça e sexta, 6h (Brasília)
                 ├─ integração acadêmica: login, vínculo do aluno, consentimento, currículo, painel admin
                 │     └─ fonte da faculdade (view SQL ou API) e login institucional (OIDC), por variável
                 └─ Firestore: vagas, cota da SerpApi, consentimentos, currículos, marcações, auditoria, administradores
```

Todos os dados do StartMe ficam no Firestore e só o backend os acessa (as regras em `coletor/firestore.rules`
negam o acesso direto dos navegadores). O PostgreSQL do repositório existe **apenas** na faculdade simulada
(`simulador-fsa/`), para testar a integração; o StartMe não usa banco relacional em produção.

## Estrutura

```
coletor/                  backend (Python / FastAPI), publicado no Cloud Run
  main.py                 vagas, coleta, saúde, CORS e acesso ao Firestore
  fontes/serpapi.py       fonte de vagas: busca, filtro, normalização, cota e gravação
  integracao/             camada de integração acadêmica
    config.py             leitura e validação das variáveis, incluindo a trava de entrega
    provedores/           fontes de vínculo: arquivo (fictício), sql e http
    autenticacao.py, oidc.py, sessao.py, cpf.py     login, sessão e CPF pseudonimizado
    servicos.py, admin.py, rotas.py                 regras e rotas do aluno e do administrador
    repositorio/          persistência (Firestore em produção, memória nos testes)
    cli.py                `doctor` (diagnóstico) e `admin-criar`
  tests/                  testes pytest (sem rede, sem SerpApi e sem Firebase reais)
  scripts/testar_firestore.py   teste de conexão com o Firestore
  Dockerfile, docker-compose.local.yml (emulador), docker-compose.real.yml (Firestore real)
  .env.example            todas as variáveis, comentadas
frontend-react/           interface do aluno e painel do administrador (React 18 + Vite + Tailwind); ver o README da pasta
simulador-fsa/            faculdade simulada (Postgres, API e login fictícios); ver o README da pasta
e2e/                      teste de ponta a ponta com navegador, nos três modos de integração
.github/workflows/        ci.yml (testes), e2e.yml (ponta a ponta), deploy.yml (publicação)
design-reference/         protótipo de design de origem e mapa de telas
docs/
  ADOCAO-FSA.md           guia de adoção pela faculdade
  SERVIDOR-FALSO-FSA.md   a faculdade simulada e o que trocar pelo sistema real
  arquitetura/            topologia e documentação do MVP
  historico/              rascunhos antigos, só como referência
```

## Como rodar localmente

### Coletor (backend)

```bash
cd coletor
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
```

No `.env`, preencha `SCRAPER_TOKEN` e, se for coletar vagas, `SERPAPI_KEY`. Para rodar com `uvicorn`, **descomente
também `MODO_DEMONSTRACAO=true`**: sem ela, a trava de entrega impede o serviço de subir com o login de demonstração
e os alunos fictícios (é o comportamento esperado em produção, não um erro). O compose local já define essa variável.

Para acessar o Firestore, há três caminhos:

| Caminho | Como | Quando usar |
|---|---|---|
| Emulador (recomendado) | `docker compose -f docker-compose.local.yml up --build -d` | desenvolvimento: nada vai para o Firebase real |
| Credencial do gcloud | `gcloud auth application-default login` e `GOOGLE_CLOUD_PROJECT=<projeto>` | testar contra o Firestore real sem arquivo de chave |
| Arquivo de chave | `GOOGLE_APPLICATION_CREDENTIALS` apontando para o JSON da conta de serviço | só se a organização permitir criar chaves; o arquivo nunca é versionado |

Sem o compose, configure antes o segundo ou o terceiro caminho da tabela (sem acesso ao Firestore, o serviço não sobe):

```bash
uvicorn main:app --reload --env-file .env
curl http://localhost:8000/health
```

O teste de conexão com o Firestore real grava, lê e apaga um documento temporário:
`python scripts/testar_firestore.py` (com `FIRESTORE_EMULATOR_HOST` ausente).

### Front

```bash
cd frontend-react
npm install
cp .env.example .env.local     # VITE_COLETOR_URL=http://localhost:8000
npm run dev                    # http://localhost:5173
```

Sem o backend no ar, o front funciona com vagas de demonstração e avisa na tela. Login de demonstração: CPF
`000.000.000-00`, senha `senha`.

### Faculdade simulada e teste de ponta a ponta

```bash
cd simulador-fsa && docker compose up --build -d       # Postgres 5433, API 8101, login 8102
```

O teste de ponta a ponta (`e2e/`) sobe o emulador do Firestore, o simulador, o coletor e o front, e percorre a jornada
do aluno e do administrador nos três modos (arquivo + login demo, SQL + login demo, API + login da FSA). Requer
Docker, Node 22, Chrome e o `coletor/.venv` instalado:

```bash
cd frontend-react && VITE_COLETOR_URL=http://localhost:8000 npm run build
cd ../e2e && npm install && npm run e2e
```

### Testes

```bash
cd coletor && pytest                                  # backend
cd frontend-react && npm run lint && npm test         # front (oxlint e Vitest)
cd coletor && pytest ../simulador-fsa/tests          # faculdade simulada (usa o ambiente do coletor)
```

## API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/health` | público |
| GET | `/api/vagas` | público |
| POST | `/api/coleta` | cabeçalho `X-Scraper-Token` (usado pelo Cloud Scheduler) |
| GET | `/api/publico/config` | público: modo de login, fonte, `simulado`, `sessao_ativa`, `modo_demonstracao` |
| POST | `/api/auth/entrar`, `/api/auth/sair` | login demo ou por senha validada pela faculdade |
| GET | `/api/auth/oidc/iniciar`, `/api/auth/oidc/retorno` | login institucional (só com `AUTH_MODE=oidc`) |
| GET, DELETE | `/api/me` | aluno com sessão: dados do vínculo; `DELETE` apaga a conta |
| PUT, DELETE | `/api/me/consentimento` | aluno: aceitar ou revogar (revogar apaga currículo e marcações) |
| GET, PUT | `/api/me/curriculo`, `/api/me/marcacoes` | aluno com consentimento |
| POST | `/api/admin/entrar`, `/api/admin/sair` | administrador |
| GET | `/api/admin/resumo`, `/api/admin/auditoria` | administrador (`admin` ou `leitor`) |
| POST | `/api/admin/coleta` | só `admin`, com trava de cota e intervalo |

As rotas de aluno e administrador respondem 503 enquanto `SESSAO_SEGREDO` e `CPF_PEPPER` não estiverem
configurados; nesse caso o front segue no modo local de demonstração.

`GET /api/vagas` devolve `id, titulo, empresa, link, data_coleta, descricao, salario` e, como campos extras,
`fonte`, `via` (portal onde o Google achou a vaga) e `logo`.

## Coleta de vagas (SerpApi)

`POST /api/coleta` remove as vagas expiradas e roda `SERPAPI_QUERIES` × `SERPAPI_LOCALIZACOES` (até
`SERPAPI_MAX_PAGINAS` páginas cada). Entram só vagas de **estágio, trainee e júnior** (regra em
`fontes/serpapi.py`, constantes `REGRA_*`; "aprendiz" e níveis pleno/sênior ficam fora). O upsert usa o `htidocid`
do Google (o `job_id` muda a cada busca).

**Cota.** Uma execução faz no máximo `SERPAPI_MAX_BUSCAS_EXEC` (16) buscas, e o contador mensal (coleção
`controle_serpapi`) bloqueia novas chamadas ao atingir `SERPAPI_LIMITE_MENSAL` (240 do plano gratuito de 250). Os
padrões buscam em São Paulo e nas 7 cidades do Grande ABC: 2 consultas × 8 localidades = 16 buscas por coleta. Por
isso a coleta roda **duas vezes por semana** (cerca de 128 buscas por mês). Para testar gastando 1 busca, defina
`SERPAPI_QUERIES` e `SERPAPI_LOCALIZACOES` com um único valor.

**Falhas.** Falha ou cota esgotada não derrubam a rota: o motivo vem em `serpapi.erro` na resposta. Falhas
transitórias (rede, timeout de `SERPAPI_TIMEOUT`, 5xx) têm 1 nova tentativa; se persistirem, só aquela busca é
pulada (3 falhas seguidas interrompem). Chave inválida (401/403) e limite de taxa (429) param tudo na hora. O
contador local conta também buscas que a SerpApi serviu do cache (grátis), então marca um pouco acima do uso real.

**Região.** Só entram vagas de São Paulo (capital e zonas) e do Grande ABC (Santo André, São Bernardo do Campo, São
Caetano do Sul, Diadema, Mauá, Ribeirão Pires e Rio Grande da Serra), conferidas pelo campo `location` do Google
(lista `CIDADES_ALVO`). Vagas remotas ficam de fora, a menos que `SERPAPI_ACEITAR_REMOTO=true`. Salários em "mil"
(`R$ 2 mil`) são gravados como número (`R$ 2.000`).

**Logo da empresa.** O coletor baixa o `thumbnail` do Google Jobs e grava na vaga como data URI no campo `logo`, então
o navegador do aluno não depende da SerpApi. Só baixa de `serpapi.com`, só aceita PNG/JPEG/GIF/WebP (nunca SVG,
conferido pela assinatura dos bytes), limita a 20 KB e descarta o ícone genérico de "sem logo". Não gasta cota.

**Cache de `GET /api/vagas`.** A lista fica em memória por `VAGAS_CACHE_TTL` segundos (padrão 120), então uma rajada de
requisições custa uma única leitura do Firestore. Uma coleta invalida o cache; se o Firestore falhar, serve a cópia
vencida. O cabeçalho `X-Cache` (HIT, MISS ou STALE) permite medir o efeito nos ensaios de carga.

**CORS.** Lista explícita em `ALLOWED_ORIGINS` (nunca `*`; barra final é removida). O padrão cobre o Vite (`5173` e
`4173`) e o Live Server (`5500`), em `localhost` e `127.0.0.1`. Em produção não é necessário: o site e a API estão na
mesma origem pelo Firebase Hosting.

## Publicação (CI/CD)

- **`ci.yml`**: em todo push e pull request, roda os testes do coletor e do simulador, o lint, os testes e o build do
  front, e constrói a imagem Docker do coletor.
- **`e2e.yml`**: em push na `developer` (ou manualmente), roda o teste de ponta a ponta nos três modos.
- **`deploy.yml`**: quando o CI passa na `main`, publica o coletor no Cloud Run e o front no Firebase Hosting. A
  autenticação é por Workload Identity Federation (sem chave guardada no GitHub), restrita a este repositório e à `main`.

As variáveis do serviço (incluindo `MODO_DEMONSTRACAO`) ficam na configuração do Cloud Run e não são alteradas pelo
deploy. Fluxo de trabalho: alterações entram por branch, são integradas na `developer` e só chegam à `main` (produção)
depois de testadas.

## Segurança

- Nenhum segredo no repositório. Em produção, segredos ficam no Secret Manager e nas variáveis do Cloud Run; o `.env`
  é só para desenvolvimento e está no `.gitignore` (e fora da imagem Docker).
- A rota de coleta exige token; sem `SCRAPER_TOKEN` configurado ela responde 503 em vez de operar aberta.
- CPF pseudonimizado (HMAC com `CPF_PEPPER`), nunca devolvido nem gravado em claro; sessão em cookie `HttpOnly`.
- Senhas de administrador em argon2; auditoria sem dados pessoais.
- Conteúdo coletado é tratado como texto pelo React e links de vagas só aceitam `http`/`https`.
- Trava de entrega: sem `MODO_DEMONSTRACAO=true`, o serviço não sobe com login de demonstração ou alunos fictícios.
- Limitações conhecidas e o que já foi revisado: `docs/ADOCAO-FSA.md`.

## Pendências conhecidas

1. Conferir os Termos de Uso da SerpApi/Google Jobs para o uso acadêmico e registrar a decisão de trocar o scraping
   direto do portal Companhia de Estágios pela SerpApi.
2. Os requisitos das vagas e a grade do curso usados no match são de demonstração. O match real depende de extrair
   requisitos estruturados dos anúncios e de a faculdade fornecer a matriz curricular.
3. A interface foi testada em emulação de dispositivos móveis, não em aparelhos reais nem com leitor de tela.
4. O ensaio de carga (C4) ainda não foi executado.
5. A integração com a FSA foi validada só contra a faculdade simulada; falta o teste com o sistema real (checklist acima).

## Histórico

O código começou em duas pastas separadas (o coletor em Python e um cadastro em Node.js com MySQL), consolidadas
neste repositório em 02/09/2026. Em 13/10/2026 os fronts em HTML/JS puro (`frontend/`, `cadastro/frontend/`,
`coletor/web/`) e o backend de cadastro (`cadastro/backend/`, MySQL) foram substituídos pelo front React e pela camada
de integração acadêmica. Para consultar o código antigo: `git checkout legado-pre-react`.
