# StartMe

## O que é o projeto

StartMe é uma plataforma (TCC de Engenharia da Computação) que conecta **instituições de ensino**, **empresas** e **alunos**:

- **Instituições** cadastram **cursos**.
- **Empresas** cadastram **vagas** de emprego/estágio.
- **Alunos** se cadastram vinculados a um curso.

Hoje o projeto é um painel administrativo simples (sem login) para cadastrar e gerenciar esses dados via formulários web que conversam com uma API REST própria.

## Como funciona

O projeto é dividido em duas partes que rodam separadamente e se comunicam por HTTP/JSON:

- **Frontend** (`frontend/`): páginas HTML estáticas. Cada página carrega um script que faz `fetch` para a API e monta as tabelas/formulários na hora.
- **Backend** (`backend/server.js`): API REST em Express que recebe essas requisições e executa `SELECT`/`INSERT`/`UPDATE`/`DELETE` no MySQL.

Fluxo de telas:

```
Home.html
  ├── Aluno.html      → lista e cadastra Alunos (usa o combo de Curso vindo da API)
  └── Cadastro.html   → cadastra Empresas/Instituições e suas Vagas/Cursos
                         (inclusive adicionar vaga/curso a um cadastro já existente)
```

Cada tela chama a API assim (exemplo real usado pelo `script_final.js`):

```js
const API_URL = 'http://localhost:3000';
fetch(`${API_URL}/empresas`)        // lista
fetch(`${API_URL}/empresas`, { method: 'POST', body: JSON.stringify(dados) })   // cria
fetch(`${API_URL}/empresas/${id}`, { method: 'PUT', ... })     // edita
fetch(`${API_URL}/empresas/${id}`, { method: 'DELETE' })       // remove
```

Não há autenticação, sessão ou controle de acesso — qualquer pessoa com acesso à API pode ler/alterar tudo. Isso é esperado no estágio atual, mas é o primeiro ponto a evoluir (ver seção de melhorias).

## Stack atual

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript puro (sem framework/build step) |
| Frontend (visual) | Bootstrap 4.1.3, jQuery 3.3.1 e Popper.js (via CDN), Font Awesome (via CDN) |
| Backend | Node.js + [Express 5](https://expressjs.com/) |
| Acesso a dados | [mysql2](https://www.npmjs.com/package/mysql2) (promise pool, queries parametrizadas) |
| Banco de dados | MySQL 8 (schema `DB12`) |
| Modelagem do banco | MySQL Workbench (`database/Modelagem de dados.mwb`) |
| CORS | pacote `cors` liberado (`app.use(cors())`, sem restrição de origem) |

Não há ORM, testes automatizados, variáveis de ambiente ou containerização ainda — tudo isso são pontos naturais de evolução.

### Modelo de dados

```
Instituicao (1) ──< Curso (1) ──< Aluno
Empresa     (1) ──< Vagas
```

- `Empresa`: Id_Empresa, Nome, Area, CNPJ, Endereco, Email, Telefone
- `Instituicao`: Id_Instituicao, Nome, Tipo, CNPJ, Area_Atuacao, Pais, Estado, Cidade, Endereco, Telefone, Email
- `Curso`: Id_Curso, Nome, Carga_Horaria, Descricao, Qtd_Semestre, Id_Instituicao (FK)
- `Aluno`: Id_Aluno, Nome, CPF (único), RG, Idade, Data_Nascimento, Semestre, Id_Curso (FK)
- `Vagas`: Id_Vaga, Titulo, Descricao, Salario, Id_Empresa (FK)

Chaves estrangeiras com `ON DELETE CASCADE` — excluir uma Instituição apaga seus Cursos e, em cascata, os Alunos vinculados (mesma coisa para Empresa → Vagas). Vale revisar se esse é o comportamento que você quer manter.

### Endpoints da API

Todos os recursos seguem o mesmo padrão REST (`empresas`, `instituicoes`, `cursos`, `vagas`, `alunos`):

| Método | Rota | Ação |
|---|---|---|
| GET | `/:recurso` | Lista todos |
| GET | `/:recurso/:id` | Busca um por ID (404 se não existir) |
| POST | `/:recurso` | Cria (retorna `insertId`) |
| PUT | `/:recurso/:id` | Atualiza (404 se não existir) |
| DELETE | `/:recurso/:id` | Remove (404 se não existir) |

Exemplo: `GET /alunos`, `GET /alunos/3`, `POST /alunos`, `PUT /alunos/3`, `DELETE /alunos/3`.

## Como rodar localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) 18+ instalado (`node -v` para conferir)
- MySQL Server 8 instalado e rodando localmente
- Um cliente MySQL para rodar o script (MySQL Workbench, DBeaver, `mysql` CLI, ou a extensão SQLTools do VSCode — já pré-configurada em `.vscode/settings.json`)

### 1. Criar o banco de dados
Rode o script `database/schema.sql` no seu MySQL. Ele cria o schema `DB12` e todas as tabelas:

```bash
mysql -u root -p < "database/schema.sql"
```

(ou abra o arquivo no MySQL Workbench/DBeaver e execute)

### 2. Configurar a conexão do backend
Abra `backend/server.js` e confira se o bloco de conexão bate com o seu MySQL local:

```js
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',   // <- troque para a senha do seu MySQL
    database: 'DB12'
});
```

> A senha está hardcoded no código (não há `.env` ainda). Ajuste esse valor para a senha real do seu usuário `root` local antes de continuar.

### 3. Instalar dependências e subir a API

```bash
cd backend
npm install
npm start
```

Se tudo estiver certo, aparece no terminal:
```
Servidor rodando em http://localhost:3000
```

Teste rápido para confirmar que a API está de pé e conectada ao banco:
```bash
curl http://localhost:3000/empresas
```
Deve responder `[]` (lista vazia, banco recém-criado) — se der erro de conexão, revise usuário/senha/porta do MySQL no passo 2.

### 4. Abrir o frontend
O frontend não precisa de build nem servidor Node — são páginas estáticas. Duas formas de abrir:

- **Direto no navegador**: dê duplo clique em `frontend/Home.html` (ou clique com botão direito → abrir no navegador).
- **Com Live Server** (recomendado, evita problemas de cache/caminho relativo): no VSCode, instale a extensão "Live Server", clique com botão direito em `frontend/Home.html` → "Open with Live Server".

Com a API rodando (passo 3) e o frontend aberto, navegue: `Home.html` → `Cadastro.html` para cadastrar uma Empresa/Instituição (e uma Vaga/Curso), depois `Aluno.html` para cadastrar um aluno vinculado ao curso criado. Os dados cadastrados devem aparecer nas tabelas da própria página (a lista é recarregada a cada ação via `fetch`).

---

## Histórico: de onde vieram esses arquivos

Esta pasta é o resultado da análise e fusão de duas pastas originais do TCC que existiam separadamente:

- `V 1.6/` — versão mais **avançada e madura** do código.
- `StartMe +Backend + Banco ok/` — versão mais **antiga**, porém já com uma tentativa de organização em subpastas (`Backend/`, `DB/`).

Comparei arquivo a arquivo (HTML, CSS, JS, SQL, `server1.js`, `package.json`). Conclusão: **`V 1.6` não é um projeto separado, é uma versão posterior do mesmo projeto** — os nomes dos arquivos são idênticos, o schema do banco é quase idêntico, e o código de `V 1.6` sempre contém tudo que está em `StartMe` mais melhorias em cima. Nenhum arquivo do `StartMe` tinha algo funcional que não existisse também (de forma melhor) em `V 1.6`.

Diferenças concretas encontradas:

| Arquivo | StartMe (antiga) | V 1.6 (nova) |
|---|---|---|
| `server1.js` | Sem try/catch, sem rota GET por ID, **bug**: dois `app.listen` chamados (um deles nunca funcionaria) | Try/catch em toda rota, middleware de erro global, rota `GET /:id` em todos os recursos, retorna `insertId` no POST, um único `app.listen` |
| `Aluno.html` | Campo "ID da Instituição" digitado manualmente (usuário digita um número — propenso a erro) | `<select>` de cursos carregado dinamicamente da API, botões de Ações (editar/excluir), botão Cancelar |
| `Cadastro.html` | Só cria empresa/instituição + vaga/curso juntos | Além disso, permite adicionar vaga/curso a uma empresa/instituição **já existente**, tabelas com coluna ID |
| `estilo.css` / `estilo-aluno.css` | Sem estilos de overlay/botões de ação | Overlay escurecido atrás do formulário, `.btn-editar`, `.btn-excluir` |
| `script_final.js` | 7 KB, mais simples | 39 KB, com CRUD completo (criar/editar/excluir com confirmação, cancelar edição), bem comentado |
| `Script_banco_dados.sql` / `Startmedb.sql` | Idêntico, só com 4 linhas extras de `SELECT` de teste no fim | Igual, sem esse resíduo |
| Modelagem do banco | Não existe | `Modelagem de dados.mwb` (MySQL Workbench) — **só existe na V 1.6**, é o diagrama ER do banco |
| Pasta `Imagens/` | Existe, com os 4 arquivos usados pelo CSS | **Não existe** na V 1.6, mas o CSS da V 1.6 referencia os mesmos caminhos `Imagens/...` |
| Docs "API Completa/Estrutura base - GPT" | Rascunhos de uma API antiga, com tabela `Usuarios` e `InscricaoVagas` que **não existem** no schema atual | — |

### Estrutura desta pasta

```
startme-projeto-v1/
├── backend/          # API Node/Express (server.js = antigo server1.js da V1.6)
│   ├── server.js
│   └── package.json
├── frontend/          # HTML/CSS/JS puro (sem framework)
│   ├── Home.html, Aluno.html, Cadastro.html
│   ├── estilo.css, estilo-aluno.css, estilo-home.css
│   ├── script.js, script-aluno.js, script_final.js
│   └── Imagens/       # trazida da pasta StartMe (a V1.6 não tinha, mas o CSS depende dela)
├── database/
│   ├── schema.sql              # antigo Script_banco_dados.sql (V1.6)
│   ├── Modelagem de dados.mwb  # diagrama ER (MySQL Workbench)
│   └── Modelagem de dados.mwb.bak
├── docs/              # rascunhos antigos da API (GPT), mantidos só como histórico
├── .vscode/settings.json   # conexão SQLTools já configurada (sem senha salva)
└── .gitignore
```

### O que foi descartado (e por quê)
- `node_modules/` das duas pastas antigas — reinstale com `npm install` dentro de `backend/`.
- `package-lock.json` antigos — serão regerados no `npm install`.
- As duas versões antigas de `server1.js`, HTMLs, CSSs e JS (mantidas apenas nas pastas originais, não copiadas) — eram estritamente inferiores às da `V 1.6`.
- As 4 linhas de `SELECT` de teste no final do SQL da pasta StartMe.

## Pontos de atenção para quando for melhorar

1. **Segurança**: a senha do MySQL está hardcoded em `backend/server.js` (`password: 'root'`) — mova para variável de ambiente (`.env` + `dotenv`) antes de qualquer deploy. Também não há autenticação/autorização em nenhuma rota.
2. **`package-lock.json`**: não veio nesta pasta de propósito — rode `npm install` dentro de `backend/` para gerá-lo (confirme a versão do Node que você tem instalada).
3. Os textos em `docs/` descrevem uma API antiga (tabela `Usuarios`, `InscricaoVagas`) que **não bate** com o schema/backend atuais — são só para consulta histórica, não use como referência de arquitetura.
4. O front-end é HTML/CSS/JS puro sem build step — para "dar um corpo melhor" ao TCC, esse é o ponto onde vale decidir se migra para algo como React/Vite (facilita manutenção) ou mantém simples e foca em melhorar o backend/documentação.
5. `ON DELETE CASCADE` nas foreign keys apaga em cascata (Instituição → Curso → Aluno, Empresa → Vaga) — confirme se é esse o comportamento desejado antes de usar em produção.
