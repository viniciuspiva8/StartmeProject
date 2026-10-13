# Plano: migração completa para React + StartMe "plug and play" para a FSA

## Contexto

O StartMe está no ar (Cloud Run + Firebase Hosting + CI/CD). Falta o que o torna adotável pela faculdade:
o front React cobre só parte das 13 pranchas, ainda existem 3 fronts antigos (`frontend/`, `cadastro/`, `coletor/web/`),
e os dados acadêmicos vêm de mock. Objetivo: a FSA adota **mudando só variáveis de ambiente** e o StartMe passa a buscar,
pelo CPF do usuário autenticado, o que precisa (vínculo, curso, semestre). Base: ADR-002 (contrato mínimo, sem CPF na resposta).
Prazo: congelamento de código em 23/10/2026. Eu trabalho sozinho esta noite; o Vinicius só revisa e faz o merge.

## Decisões já tomadas (respostas dele)

- **Entrega:** uma branch por grande alteração, commits pequenos por checkpoint; tudo integrado na branch `developer`
  para testar junto (não vai à produção). Ele faz o merge na `main` de manhã. **Eu nunca faço push na `main`.**
- **Dados do StartMe: 100% Firestore** (consentimento, currículo, marcações, administradores, auditoria).
- **Postgres = simulação da faculdade (`faculdade_sim`)**, só local/Docker/CI, para provar o plug-and-play. Substitui o `startme` Postgres do ADR-002 (registrar no ADR-004).
- **Legado:** apagar `frontend/`, `cadastro/` (Node+MySQL) e `coletor/web/` depois do porte, com tag `legado-pre-react`.
- **Extras: sim para tudo:** tela de admin, currículo no servidor, login único da FSA (OIDC).
- Ele quer ver **como foi feito o servidor falso e como trocar por um real**: vira documentação (abaixo).
- Se o limite de uso estourar, **continuar até 100%** quando voltar: ver "Retomada".

## Arquitetura alvo

Mesmo serviço Cloud Run (`startme-coletor`; evita novo serviço público, IAM novo e CORS) com módulos novos em `coletor/integracao/`:

```
coletor/
  main.py, fontes/            # coleta (já existe): só ganha includes de routers
  integracao/
    config.py                 # lê env, valida na subida, expõe GET /api/publico/config (modo, simulado, provedor)
    cpf.py                    # validar (DV), normalizar, mascarar (***.456.789-**), hash HMAC-SHA256 com pepper
    contrato.py               # Pydantic: Vinculo{ativo, curso, semestre, nome}, Grade (opcional)
    provedores/{base,arquivo,sql,http}.py   # ProvedorAcademico.vinculo(cpf)/grade(cpf)/saude()
    autenticacao/{demo,http_credenciais,oidc}.py
    sessao.py                 # JWT HS256 em cookie HttpOnly chamado __session (único que o Hosting repassa)
    repositorio/{base,firestore,memoria}.py # consentimentos, curriculos, marcacoes, auditoria, administradores
    rotas/{auth,me,admin,publico}.py
    cli.py                    # `doctor` (diagnóstico de adoção) e `admin-criar`
simulador-fsa/                # a "faculdade falsa" (ver abaixo)
```

- **Plug-and-play = dois eixos independentes por variável:** `AUTH_MODE = demo | oidc | http` e
  `ACADEMICO_PROVIDER = arquivo | sql | http`. `sql` roda uma consulta parametrizada (`:cpf`) com colunas
  `ativo,curso,semestre,nome` sobre qualquer URL SQLAlchemy (ex.: uma view da FSA). `http` chama um endpoint com URL
  `{cpf}` + cabeçalho/chave e **mapeia o JSON por caminhos** (`ACADEMICO_HTTP_MAPA`), então serve para formas de resposta diferentes.
- **Segurança/LGPD:** CPF validado e nunca logado nem devolvido inteiro; chave do aluno = HMAC do CPF; JWT só com
  `sub=hash` + vínculo (nome, curso, semestre); `Cache-Control: private, no-store`; limite de tentativas no login;
  consentimento versionado com revogação que apaga currículo/marcações (`DELETE /api/me`); auditoria sem PII.
  Segredos novos (`SESSAO_SEGREDO`, `CPF_PEPPER`, `OIDC_*`) vão no Secret Manager **de manhã**: sem eles os endpoints de
  sessão ficam desligados e o front cai no fluxo demo atual (produção não quebra).
- **Admin:** papéis `admin`/`leitor` no Firestore (senha argon2), login separado, visão geral (vagas, cota SerpApi
  do mês, última coleta, consentimentos), "disparar coleta" (com aviso de custo e carência), auditoria.

## Simulador da FSA (o "servidor falso") em `simulador-fsa/`

1. `docker-compose.yml`: Postgres 16 `faculdade_sim` com migrações versionadas (`0001_schema.sql`, `0002_seed_ficticio.sql`; CPFs fictícios válidos).
2. `api/` (FastAPI): "TOTVS-like" REST em outro formato (ex.: `/fsa/alunos/{cpf}/vinculo` com `X-API-Key`), lendo do Postgres.
3. `idp/` (FastAPI): OIDC mínimo (discovery, authorize com formulário, token, JWKS RS256, claim `cpf`).
4. Trocar para o real = só variáveis: `ACADEMICO_PROVIDER=http|sql`, `ACADEMICO_HTTP_URL`, `ACADEMICO_HTTP_MAPA`,
   `OIDC_ISSUER`, `OIDC_CLIENT_ID/SECRET`, `OIDC_CPF_CLAIM`, `SIMULADO=false`. Documentado com os 3 modos lado a lado.

## Fases (uma branch por fase, `--no-ff` para `developer`; cada uma termina com testes verdes)

| # | Branch | Entrega | Gate |
|---|---|---|---|
| 0 | `docs/execucao` | `docs/execucao/{PROGRESSO,DIARIO,DECISOES-PENDENTES}.md`; atualizar `developer` (fast-forward da `main`); CI também em `developer` e `feat/**` | CI verde |
| 1 | `refactor/front-organizacao` | Dividir `Curriculo.jsx` (576 linhas/17 componentes) e `AppContext.jsx`; Vitest nas libs (`match`, `vagas`, `cpf`) | auditoria mobile = 0 regressões |
| 2 | `feat/integracao-nucleo` | config, cpf, contrato, provedor `arquivo`, sessão, auth `demo`, repositório Firestore+memória, `/api/auth`, `/api/me`, consentimento, `DELETE /api/me`, auditoria | pytest (≥ testes de IDOR, cookie, sem CPF em resposta/log) |
| 3 | `feat/integracao-provedores` | provedores `sql` e `http` + mapa; auth `http`; CLI `doctor`; **testes de contrato** rodando a mesma suíte nos 3 provedores | pytest |
| 4 | `feat/simulador-fsa` | Postgres+migrações+seed, API falsa, IdP falso, docs do servidor falso | compose sobe e responde |
| 5 | `feat/auth-oidc` | OIDC (code+PKCE, state, verificação JWKS) contra o IdP falso | pytest + compose |
| 6 | `feat/front-integracao` | cliente de API, login real/demo, consentimento no servidor, Perfil (9), Exceções (10), Certificados (13), faixa "simulado" guiada por config, botão OIDC | Vitest + auditoria mobile |
| 7 | `feat/curriculo-servidor` | `GET/PUT /api/me/curriculo` e marcações; migração do localStorage; fallback offline | pytest + e2e |
| 8 | `feat/admin` | backend e tela (lazy), CLI `admin-criar` | pytest + e2e |
| 9 | `test/e2e-plug-and-play` | compose e2e + Puppeteer rodando **3 vezes só trocando env**: (a) arquivo+demo, (b) sql+demo, (c) http+OIDC; CI roda tudo no GitHub Actions (grátis, repo público) | e2e verde nos 3 modos |
| 10 | `chore/remover-legado` | tag `legado-pre-react`, `git rm` dos 3 fronts, corrigir referências | CI verde |
| 11 | `docs/adocao-fsa` | `docs/ADOCAO-FSA.md`, `docs/SERVIDOR-FALSO-FSA.md`, ADR-003 (Azure→GCP), ADR-004 (integração + Firestore); README; `tcc/documento/ATUALIZACOES-PARA-O-DOCUMENTO-TCC.md` | revisão |
| 12 | (integração) | `developer` completo, verificação final, `docs/execucao/MANHA.md` com o checklist dele | tudo verde |

## Limites de segurança desta noite

- **Não faço:** push na `main`, force-push, mexer em IAM/política da org/faturamento/segredos, criar recurso pago,
  apagar nada na nuvem, chamar a SerpApi (testes usam fakes; nenhuma coleta real), usar CPF ou dado pessoal real.
- **Posso:** branches e push em branches que não são `main`, Docker local, GitHub Actions, leituras (GET) em produção.
- **Se o classificador de permissões bloquear algo:** não contorno; registro em `DECISOES-PENDENTES.md` e sigo para a
  próxima fase independente. Se uma fase travar após 3 tentativas: registro, deixo `developer` verde e sigo.
- **RAM (~1,2 a 1,7 GB livres):** um processo pesado por vez; limites de memória nos contêineres; derrubo tudo no fim.

## Retomada (limite de uso)

`docs/execucao/PROGRESSO.md` é a fonte da verdade (checklist por fase + branch + último commit + próximo passo) e é
espelhado na memória. Ao voltar, leio o arquivo e continuo da primeira fase aberta até 100%. **Recomendo ele ligar
`autoContinueAtUsageLimit` em `/config` antes de dormir** (não posso alterar minhas próprias configurações).

## Reuso (não reescrever)

`coletor/main.py` (`get_db`, `exigir_token`, rotas), `coletor/fontes/serpapi.py` (`COLECAO_CONTROLE`, cota), `frontend-react/src/lib/api.js`
(timeout + fallback), `frontend-react/src/state/AppContext.jsx` (`gravarLocal/lerLocal`, hash→view), `src/data/{grade,requisitos}.js`,
`docker-compose.real.yml` (ADC no Docker), `.github/workflows/{ci,deploy}.yml`, script de auditoria mobile (recriar a partir da memória `project-startme-mobile`).

## Verificação

pytest (unidade + **contrato nos 3 provedores** + segurança: IDOR, cookie, sem CPF em log/resposta, JWT adulterado, cache);
Vitest nas libs do front; e2e Puppeteer (login → consentimento → vagas → salvar currículo → recarregar e conferir → admin) nos 3 modos;
auditoria mobile (0 estouro, 0 alvos <44, 0 campos <16 px); CI verde na `developer`; `npm run build` e `lint` limpos.

## De manhã, ele precisa (eu deixo pronto em `MANHA.md`)

1. Revisar e fazer o merge das branches na ordem 0→11 (ou `developer` inteira).
2. Criar 2 segredos (`SESSAO_SEGREDO`, `CPF_PEPPER`) e criar o 1º admin (`admin-criar`): comandos prontos.
3. Aprovar o ADR-003/004 e avisar o orientador; levar à TI da FSA as perguntas de `ADOCAO-FSA.md`.

## Riscos e premissas

- A API real da FSA é desconhecida: o mapa genérico cobre formatos comuns, mas só o `doctor` com acesso real prova a compatibilidade.
- Exemplos de TOTVS RM ficam marcados como **não verificados**.
- `AUTH_MODE=demo` é para a demonstração do TCC: a faixa "ambiente simulado" aparece enquanto `SIMULADO=true`.

---

# ESPECIFICAÇÃO PARA O EXECUTOR (siga à risca; não improvise arquitetura)

## Regras do executor

1. Leia primeiro: este plano, a memória (`MEMORY.md` e os arquivos que ele aponta, sobretudo `project-startme-deploy-gcp`, `reference-startme-gcloud-windows`, `project-startme-mobile`, `feedback-autorizacoes-e-custos-startme`) e `docs/execucao/PROGRESSO.md`.
2. Uma fase por vez, na ordem da tabela. Só avance com testes verdes. Atualize `PROGRESSO.md` e `DIARIO.md` a cada checkpoint.
3. Dúvida de produto/arquitetura que este plano não resolve: **não pergunte (ele está dormindo)**. Escolha a opção mais simples e segura, registre em `DECISOES-PENDENTES.md` (decisão, alternativa, por quê) e siga.
4. Commits pequenos em português, por checkpoint (nunca um commit gigante). Use o trailer de atribuição que o seu próprio lembrete de sistema indicar. Branch de cada fase sai de `developer` atualizada; ao fechar a fase: `git switch developer && git merge --no-ff <branch>` e `git push origin <branch> developer`.
5. Nunca: push na `main`, force-push, `gcloud`/`firebase` que altere a nuvem, segredos, IAM, SerpApi real, CPF real. Consultas somente leitura à nuvem são permitidas.
6. Ao ser barrado por permissão: registre e siga. Não tente contornar.
7. Antes de apagar o legado (fase 10), confirme que cada tela foi portada (Perfil, Exceções, Certificados e o que mais houver em `frontend/js/views.js`) e crie a tag `legado-pre-react`.
8. Ao final de cada fase rode: `cd coletor && .venv/Scripts/python.exe -m pytest -q` e `cd frontend-react && npm run lint && npm run build && npm test`. Windows/Git Bash: veja as armadilhas abaixo.

## Variáveis de ambiente (todas opcionais; padrões seguros)

| Variável | Valores / padrão | Função |
|---|---|---|
| `AUTH_MODE` | `demo` (padrão) \| `oidc` \| `http` | Como o aluno prova quem é |
| `ACADEMICO_PROVIDER` | `arquivo` (padrão) \| `sql` \| `http` | De onde vêm vínculo/curso/semestre |
| `SIMULADO` | `true` (padrão) \| `false` | Mostra a faixa "ambiente simulado" |
| `SESSAO_SEGREDO` | ≥ 32 bytes | Assina o JWT; **ausente ⇒ `/api/auth` e `/api/me` respondem 503 `sessao_desativada`** e o front usa o fluxo demo local |
| `CPF_PEPPER` | ≥ 32 bytes | Chave do HMAC do CPF; ausente ⇒ igual acima |
| `DEMO_CPF` / `DEMO_SENHA` | `000.000.000-00` / `senha` | Só com `AUTH_MODE=demo` (o CPF demo é a única exceção à validação de DV) |
| `ACADEMICO_ARQUIVO` | `integracao/dados/alunos_ficticios.json` | Provedor `arquivo` |
| `ACADEMICO_SQL_URL` | URL SQLAlchemy | Provedor `sql` (somente leitura) |
| `ACADEMICO_SQL_CONSULTA` | `SELECT nome, curso, semestre, (situacao='ATIVO') AS ativo FROM vw_startme WHERE cpf = :cpf` | Deve ser `SELECT`; rejeitar outra coisa |
| `ACADEMICO_CPF_FORMATO` | `digitos` (padrão) \| `pontuado` | Como o CPF vai no parâmetro/URL |
| `ACADEMICO_HTTP_URL` | `https://host/fsa/alunos/{cpf}/vinculo` | Provedor `http` |
| `ACADEMICO_HTTP_CABECALHOS` | JSON `{"X-API-Key":"..."}` | Autenticação do provedor `http` |
| `ACADEMICO_HTTP_MAPA` | JSON (abaixo) | Traduz a resposta da FSA para o contrato |
| `ACADEMICO_TIMEOUT` | `5` | Segundos |
| `AUTH_HTTP_URL` | URL | Modo `http`: POST `{cpf, senha}` → 200/401 |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_CPF_CLAIM` (`cpf`), `OIDC_REDIRECT_URI` | | Modo `oidc` (code + PKCE) |
| `TERMO_VERSAO` | `2026-10` | Versão do texto de consentimento |

**Mapa do provedor `http`** (caminhos pontilhados; `ativo` aceita lista de valores):
```json
{"nome":"Aluno.Nome","curso":"Matricula.Curso.Nome","semestre":"Matricula.PeriodoAtual",
 "ativo":{"caminho":"Aluno.Situacao","em":["Matriculado","Ativo"]}}
```
Sem `nome` na resposta, o contrato aceita `nome: null`. Resposta 404 do provedor ⇒ aluno sem vínculo (`ativo=false`, não é erro). Erro de rede/5xx/timeout ⇒ 503 `academico_indisponivel`.

## Contrato interno e API (JSON, português nos textos, `Cache-Control: private, no-store` em tudo que é de aluno)

```
Vinculo = {ativo: bool, curso: str, semestre: int, nome: str|null}      # nunca CPF/RG/matrícula
```
| Rota | Corpo → resposta | Erros |
|---|---|---|
| `GET /api/publico/config` | → `{modo_auth, provedor, simulado, versao_termo, sessao_ativa, oidc}` | |
| `POST /api/auth/entrar` | `{cpf, senha}` → 200 `{vinculo, cpf_mascarado}` + cookie `__session` | 401 credenciais; 403 `vinculo_inativo`; 422 CPF inválido; 429; 503 `sessao_desativada`/`academico_indisponivel` |
| `POST /api/auth/sair` | → 204, apaga o cookie | |
| `GET /api/auth/oidc/iniciar` e `/retorno` | 302 para o IdP; no retorno valida `state`, PKCE, assinatura (JWKS), `iss`, `aud`, `exp`, extrai `OIDC_CPF_CLAIM`, consulta o provedor, cria sessão, 302 `/#/autorizacao` | 400/403 |
| `GET /api/me` | → `{vinculo, cpf_mascarado, consentimento:{aceito, versao, aceito_em}}` | 401 |
| `PUT /api/me/consentimento` | `{aceito:true, versao}` → 200 | 401, 422 versão diferente de `TERMO_VERSAO` |
| `DELETE /api/me/consentimento` | revoga **e apaga** currículo e marcações → 204 | |
| `GET/PUT /api/me/curriculo` | `{dados:{...}, versao:int}` (≤ 64 KB; `versao` otimista) | 409 se a versão do corpo ≠ a salva; 413 |
| `GET/PUT /api/me/marcacoes` | `{salvas:[id], aplicadas:[id]}` (≤ 500 ids) | |
| `DELETE /api/me` | apaga tudo do aluno → 204 | |
| `POST /api/admin/entrar` / `sair` | `{email, senha}` → cookie `__session` com `aud=admin` | 401 genérico; 429 |
| `GET /api/admin/resumo` | `{vagas, cota:{usadas,limite}, ultima_coleta, consentimentos:{ativos,total}}` | 401/403 |
| `POST /api/admin/coleta` | só `admin`; chama a função interna de coleta; exige cota restante ≥ 16 e 1 h desde a última manual | 429, 403 |
| `GET /api/admin/auditoria?limite=50` | eventos recentes | |

**Cookie:** nome **`__session`** (único que o Firebase Hosting repassa ao Cloud Run), `HttpOnly`, `Secure` (exceto `AMBIENTE=local`), `SameSite=Lax`, `Path=/`. **JWT:** HS256; claims `sub` (= HMAC-SHA256 hex do CPF), `aud` (`aluno`|`admin`), `nome`, `curso`, `semestre`, `ativo`, `role` (admin), `iat`, `exp` (8 h aluno, 2 h admin). Rejeitar token sem `aud` correto. Limite de login: 5 falhas/10 min por IP+CPF-hash (em memória por instância é aceitável), resposta idêntica para "CPF inexistente" e "senha errada".

## Firestore (acesso só pelo backend; as regras `deny all` continuam)

`aluno_consentimentos/{cpf_hash}` `{aceito, versao, aceito_em, revogado_em}` · `aluno_curriculos/{cpf_hash}` `{dados, versao, atualizado_em}` ·
`aluno_marcacoes/{cpf_hash}` `{salvas, aplicadas, atualizado_em}` · `auditoria/{auto}` `{quando, evento, ator, detalhe}` (ator = `aluno:<8 primeiros do hash>` | `admin:<email>` | `sistema`; nunca CPF) ·
`administradores/{email}` `{senha_hash(argon2), papel(admin|leitor), ativo, criado_em}`. Atualização do currículo com **transação** (comparar `versao`).
Tudo atrás de `repositorio/base.py` (interface) com `memoria.py` para os testes; o código das rotas nunca importa Firestore direto.

## Simulador da FSA (`simulador-fsa/`)

- Portas: Postgres `5433`, API falsa `8101`, IdP falso `8102`. Memória: `mem_limit` em cada contêiner.
- Postgres `faculdade_sim`: tabelas `curso(id, nome, qtd_semestres)`, `aluno(id, cpf, nome, situacao, id_curso, periodo_atual)`; view `vw_startme(cpf, nome, curso, semestre, situacao)`. Seed (fictício; CPFs válidos de exemplos públicos): `111.444.777-35` (ativo, Eng. Computação, 7º), `529.982.247-25` (ativo, Ciência da Computação, 3º), `123.456.789-09` (**trancado** → testa `vinculo_inativo`). Sempre confira o DV com o próprio validador.
- API falsa `GET /fsa/alunos/{cpf}/vinculo` (cabeçalho `X-API-Key`; 401/404/200) no formato aninhado do mapa acima (propositalmente diferente do contrato, para provar o mapeamento).
- IdP falso OIDC: `/.well-known/openid-configuration`, `/authorize` (formulário com CPF e senha de teste), `/token`, `/jwks.json` (RS256, chave gerada na subida), claim `cpf`.
- `docs/SERVIDOR-FALSO-FSA.md` explica cada peça e uma tabela "falso → real" (URL, cabeçalho, mapa, issuer, claim).

## Front (React) — arquivos e comportamento

- Novos: `src/lib/apiAluno.js` (fetch com `credentials:'include'`, timeout, erros tipados), `src/lib/cpf.js` (validar/mascarar/máscara de digitação), `src/views/{Perfil,Certificados,Excecoes}.jsx`, `src/views/admin/*` (carregado com `React.lazy` em `App.jsx`). Dividir `Curriculo.jsx` em `src/views/curriculo/*` e o estado em `src/state/*` mantendo a mesma API do contexto (menos edições nas telas).
- Rotas por hash (estenda `ROTAS` em `AppContext.jsx`): `#/perfil`, `#/certificados`, `#/excecao/<codigo>`, `#/admin`. Portar **das pranchas de `frontend/js/views.js`** (9 ≈ linha 720, 13 ≈ linha 880; a 10 procure por "Prancha 10") **antes** de apagar o legado. Exceções: `vinculo_inativo`, `academico_indisponivel`, `consentimento_recusado`, `coletor_indisponivel`, `sessao_expirada`.
- Boot: `GET /api/publico/config`; se falhar ou `sessao_ativa=false` ⇒ **fluxo demo local atual intacto** (regra do README: nenhuma falha de rede quebra a interface). Se ok: `GET /api/me` (401 ⇒ Portal).
- Currículo: grava no servidor com debounce de 800 ms e `versao`; 409 ⇒ recarrega e avisa por toast; primeiro login com servidor vazio e dados no `localStorage` ⇒ envia os locais (migração); sem rede ⇒ segue em `localStorage` e sincroniza depois.
- CPF só aparece mascarado (`***.456.789-**`). A faixa "ambiente simulado" vem de `config.simulado`. Botão "Entrar com a conta da FSA" só quando `config.oidc`.
- Mantenha as regras mobile: alvos ≥ 44 px (`min-h-11`; `inline-flex` quando precisar de altura), campos 16 px (já global), texto ≥ 12 px, sem `user-scalable=no`.

## Testes mínimos por fase (nomes sugeridos)

- Fase 2/3: `test_cpf.py` (DV, máscara, hash estável, sem log do CPF), `test_sessao.py` (adulteração, `aud`, expiração), `test_provedores_contrato.py` (**mesma suíte parametrizada** em `arquivo`/`sql`(SQLite)/`http`(`httpx.MockTransport`): ativo, inativo, 404, timeout ⇒ indisponível), `test_rotas_me.py` (**IDOR**: aluno A não lê B; sem cookie ⇒ 401; `Cache-Control`; resposta nunca contém o CPF), `test_mapa_http.py`.
- Fase 5: `test_oidc.py` (state inválido, nonce/PKCE errado, `aud`/`iss` errados, assinatura inválida, claim ausente).
- Fase 7/8: concorrência de `versao` (409), tamanho (413), papel `leitor` não dispara coleta, carência de 1 h, auditoria sem PII.
- Front: `match.test.js`, `vagas.test.js`, `cpf.test.js`; e2e Puppeteer nos 3 modos e auditoria mobile no final.

## Armadilhas já conhecidas (não repita)

- Hosting repassa só o cookie `__session`; respostas sem `Cache-Control: private` podem ser cacheadas no CDN.
- Windows: `gcloud` pelo caminho curto (`cygpath -d`), `^` quebra no cmd.exe, `/tmp` do Git Bash não existe para o Python; `sleep` isolado é bloqueado (use laço com sleep dentro). Nada de `gh` instalado.
- Tailwind v4: `min-h-*` não vale em `display:inline`; regras sem `@layer` vencem utilidades.
- Testes do coletor: rodar com `FIRESTORE_EMULATOR_HOST` ausente/vazio e `GOOGLE_CLOUD_PROJECT` não definido (os testes de `get_db` já isolam).
- Docker local usa ~256 MB para o coletor; Chrome headless um por vez; pare servidores de teste ao terminar.
- `docker-compose.real.yml` aponta ao Firestore **real**: nunca use em testes desta noite. Para e2e use o emulador (`docker-compose.local.yml` / `mtlynch/firestore-emulator`).
- A tag `legado-pre-react` precisa existir **antes** do `git rm`.

## Definição de pronto (por fase)

Testes e lint verdes · CI verde na branch e depois na `developer` · `PROGRESSO.md` e `DIARIO.md` atualizados · nenhum segredo, CPF real ou valor de `.env` em arquivo/commit · commit em português com o trailer de atribuição.

## Limites honestos de um executor mais barato

As fases de maior risco são **5 (OIDC)**, **7 (concorrência/transação no Firestore)**, **1 (refatorar o front sem regressão)** e os **testes de segurança**. Por isso há gates mais rígidos neles e uma **revisão final de código** (skill `code-review`, nível alto) antes de dar a fase 12 como pronta. Qualquer coisa duvidosa vai para `DECISOES-PENDENTES.md` para ele decidir de manhã.
