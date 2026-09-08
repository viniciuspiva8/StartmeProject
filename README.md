# StartMe

Plataforma web de empregabilidade para discentes de Tecnologia da Informação do
Centro Universitário Fundação Santo André. Trabalho de Conclusão de Curso de
Engenharia de Computação — Grupo 15, 2026.

## Baseline do projeto

O código do StartMe existia em duas pastas separadas e sem versionamento comum.
Em 02/09/2026 as duas foram consolidadas neste repositório:

| Módulo | Origem | Papel |
|---|---|---|
| `coletor/` | pasta "MVP" | **Tronco do projeto.** Python + FastAPI, coleta as vagas do portal Companhia de Estágios e persiste no Google Cloud Firestore. É o módulo que implementa a arquitetura descrita na monografia. |
| `cadastro/` | pasta "startme-projeto-v1" | Node.js + Express sobre MySQL. Modelo relacional de Instituição, Curso, Aluno, Empresa e Vaga. |

Os dois módulos juntos materializam a **persistência poliglota** (Sadalage;
Fowler, 2013) que a monografia justifica: dados de vagas são voláteis e de
esquema variável, e ficam no Firestore; dados cadastrais acadêmicos têm
integridade referencial, e ficam no relacional.

## Estrutura

```
coletor/              serviço de coleta (Python / FastAPI / Firestore)
  main.py             API e motor de scraping
  Dockerfile          imagem de execução
  .env.example        configuração de referência
  web/                interface de listagem das vagas (legada — ver "Frontend v1.1" abaixo)
cadastro/             API de cadastro (Node / Express / MySQL)
  backend/            servidor e rotas REST
  frontend/           telas de cadastro (legado)
  database/schema.sql schema DB12 e modelagem
frontend/             NOVO — interface unificada da jornada do aluno (HTML/CSS/JS vanilla, ver "Frontend v1.1" abaixo)
design-reference/     protótipo de design de origem (StartMe.dc.html) e mapa de telas
docs/
  arquitetura/        topologia e documentação do MVP
  historico/          rascunhos antigos, mantidos só como referência
```

## Como rodar

### Coletor

```bash
cd coletor
cp .env.example .env            # preencha SCRAPER_TOKEN e o caminho da credencial
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

A credencial da conta de serviço do Firebase (`credenciais.json`) **não é
versionada**. Baixe do console do Firebase e aponte
`GOOGLE_APPLICATION_CREDENTIALS` para ela.

Rotas:

| Método | Rota | Autenticação |
|---|---|---|
| GET | `/health` | — |
| GET | `/api/vagas` | — |
| POST | `/api/coleta` | header `X-Scraper-Token` |

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
| Login e consentimento (Pranchas 2 e 3) | **Mock fixo, intencional** | Credenciais de demonstração `123.456.789-00` / `demo2026`. Não é um corte de escopo: o README já lista "Não há autenticação de usuário final em nenhum dos módulos" como pendência conhecida. |

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

## Segurança

- Nenhum segredo no repositório. Credenciais e senhas vêm de `.env`, que está no `.gitignore`.
- A rota de coleta exige token; sem `SCRAPER_TOKEN` configurado ela responde 503 em vez de operar aberta.
- CORS com lista explícita de origens, sem curinga.
- Conteúdo coletado é escapado antes de ir para o DOM.

## Pendências conhecidas

1. Verificar `robots.txt` e os Termos de Uso do portal de origem antes de operar a coleta em produção — está no caminho crítico do cronograma.
2. Não há autenticação de usuário final em nenhum dos módulos.
3. Os dois módulos ainda não se integram: o `cadastro` não conhece as vagas do `coletor`.
4. Não há testes automatizados nem esteira de CI.
5. `ON DELETE CASCADE` no schema relacional apaga Instituição → Curso → Aluno em cascata; confirmar se é o comportamento desejado.
