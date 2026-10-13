# Diário da execução (conquistas e dificuldades)

Formato: data/hora, fase, o que foi feito, o que deu errado e como foi resolvido. Sem segredos, CPF real ou valores de `.env`.

## 2026-10-13 (noite)

- **Fase 0.** Plano aprovado pelo Vinicius. `developer` atualizada por fast-forward até a `main` (`8185732`); branch `docs/execucao` criada.

- **Fase 1 (integrada).** `Curriculo.jsx` (576 linhas) dividido em `views/curriculo/*`; `AppContext.jsx` ganhou `state/constantes.js` e `state/utilitarios.js`. Antes/depois: o HTML renderizado de currículo, início e vagas é idêntico (comparação de DOM). Vitest (10 testes em `match` e `vagas`). **Defeito achado pelo teste:** `derivarModalidade` não reconhecia "remota"/"híbrida" (feminino); corrigido. Auditoria mobile: 0 regressões em 54 combinações.
- **Fase 2 (em andamento).** Núcleo do backend: `coletor/integracao/` com CPF (DV, máscara, chave HMAC), configuração validada na subida, JWT HS256 mínimo sem dependência nova, provedor de arquivo, autenticação demo, repositório Firestore e rotas `/api/publico`, `/api/auth`, `/api/me`. 39 testes novos (IDOR, token adulterado e de admin, CPF fora de resposta/log/token/auditoria, limite de tentativas, consentimento e revogação). Suíte completa: 170 testes.
- **Decisão de ferramenta:** o heredoc do Git Bash quebrou ao criar arquivos; passei a usar a ferramenta de escrita de arquivos.

- **Fase 2 (integrada).** `developer` = `e53d627`, CI verde nos três jobs.
- **Fase 3 (em andamento).** Provedores `sql` (SQLAlchemy, consulta validada: um SELECT com :cpf, sem escrita) e `http` (mapa de caminhos, 404 = sem vínculo, erro = indisponível, https obrigatório) e autenticação `http`. Suíte de contrato: a mesma bateria roda em arquivo, SQLite e HTTP simulado. `python -m integracao.cli doctor` verifica a configuração sem imprimir dados. 195 testes na suíte completa.

- **Fase 3 (integrada).** Suíte de contrato nos três provedores, `doctor` validado contra o Postgres simulado e contra a API simulada.
- **Fase 4 (em andamento).** `simulador-fsa/`: Postgres com migrações (esquema e dados fictícios), API no formato da FSA (diferente do contrato, para provar o mapeamento) e IdP OIDC falso (PKCE, RS256, JWKS). Compose com limite de memória por serviço: cerca de 130 MB em uso. Validado: `doctor` com SQL e com HTTP devolvem o mesmo vínculo; o trancado é recusado nos dois. Testes do simulador (10): rodam com o venv do coletor, ainda não estão no CI (entram na Fase 9).
- **Decisão:** dependências novas do coletor: `sqlalchemy` e `psycopg[binary]` (provedor SQL e driver do Postgres). `cryptography` e `python-multipart` só no simulador.
