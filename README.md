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
  web/                interface de listagem das vagas
cadastro/             API de cadastro (Node / Express / MySQL)
  backend/            servidor e rotas REST
  frontend/           telas de cadastro
  database/schema.sql schema DB12 e modelagem
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
