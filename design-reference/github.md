repo: viniciuspiva8/StartmeProject
branch: main

## Sync history

- 2026-09-05T15:57:07Z — Lote 1 (Pranchas 5, 6, 11) desenhado sobre os campos reais da coleta.

## Last sync

date: 2026-09-05T18:40:00Z

### Updated in this project

- Todas as 11 pranchas do prompt entregues e navegáveis (jornada 1→10 + sistema em 11).
- Identidade visual reconstruída a partir do Manual da Marca da FSA (upload do usuário): Azul Institucional #042D5C, Verde-água #00A99D, Georgia + Montserrat.
- Prancha 11 documenta a origem de cada token de cor e marca o Verde-água como carecendo de confirmação (só o azul tem hex declarado no manual).
- Jornada completa clicável: portal → login simulado → consentimento → home → listagem → detalhe → candidatura → sucesso → minhas candidaturas / perfil → estados de exceção.

## Screen map

| Tela no projeto | Arquivos do repositório |
|---|---|
| Prancha 1 — Portal acadêmico | — (ambiente simulado, sem fonte no repo) |
| Prancha 2 — Login simulado | — (ambiente simulado, sem fonte no repo) |
| Prancha 3 — Consentimento | `cadastro/database/schema.sql` (campos mínimos: Aluno, Curso) |
| Prancha 4 — Painel inicial | `coletor/main.py` (`GET /api/vagas`) |
| Prancha 5 — Listagem e busca | `coletor/main.py` (modelo `Vaga`, `GET /api/vagas`), `coletor/web/index.html`, `coletor/web/script.js` |
| Prancha 6 — Detalhe da vaga | `coletor/main.py` (`descricao`/`salario` com fallback na coleta, `link` de origem) |
| Prancha 7 — Candidatura | `cadastro/database/schema.sql` (Aluno, Curso), `cadastro/backend/server.js` |
| Prancha 8 — Minhas candidaturas | — (endpoint `GET /api/candidaturas` ainda não existe; ver Prancha 11) |
| Prancha 9 — Perfil | `cadastro/database/schema.sql` (Aluno, Curso, Instituicao) |
| Prancha 10 — Estados de exceção | `coletor/main.py` (`GET /health`) |
| Prancha 11 — Sistema de design | — (novo; substitui `coletor/web/estilo.css` + Bootstrap) |
| Contratos de API exigidos | `coletor/main.py`, `cadastro/backend/server.js`, `README.md` |
