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

- **Fase 4 (integrada).** `developer` = `d5701f2`.
- **Fase 5 (em andamento).** Login único OIDC: code + PKCE S256, state assinado (jti + nonce), id_token RS256 validado (alg, assinatura pelo JWKS, iss, aud, exp, iat, nonce, CPF). 16 testes de fluxo e ataques contra o IdP falso do simulador. Verificado pela rede: discovery e redirecionamento reais. O retorno não foi exercitado no Firestore real.
- **Limitação registrada:** o login por OIDC não está amarrado ao navegador (um atacante poderia induzir a vítima a concluir o login com a conta do atacante). Mitigação futura: cookie de amarração quando o Hosting puder repassá-lo. Aceitável para o escopo do TCC; registrado em DECISOES-PENDENTES.

- **Fase 5 (integrada).** `developer` = `3b6bfd2`.
- **Fase 6 (em andamento).** Front ligado ao servidor: `lib/apiAluno.js` (sessão por cookie, erros tipados), `lib/cpf.js` (3 testes), AppContext descobre o servidor e a sessão, login real com mensagens por código, consentimento grava no servidor, botão "Entrar com a conta da FSA" quando há OIDC, faixa simulada por configuração. Telas novas: Perfil (9), Certificados (13) e Exceções (10) com os textos do legado. Modo local conferido por comparação de DOM: idêntico. Auditoria mobile em 78 combinações: zero problemas.
- **Pendente nesta fase:** e2e com o servidor real (vai para a Fase 9, quando os três modos forem testados juntos).

- **Fase 6 (integrada).** `developer` = `feb1b9a`.
- **Fase 7 (em andamento).** Currículo e marcações no servidor com versão otimista (409 em conflito, 413 acima de 64 KB). Testes: isolamento entre alunos, sessão obrigatória, limites. Front: sincronização com atraso de 800 ms, migração do navegador para o servidor no primeiro login, aviso de conflito sem sobrescrever. Modo local conferido: a única diferença é a data e a saudação da tela de início (muda com o relógio). 218 testes no backend.
- **Limitação registrada:** sem transação do Firestore (ver `DECISOES-PENDENTES.md`).

- **Fase 7 (integrada).** `developer` = `7212c1c`.
- **Fase 8 (em andamento).** Admin: argon2 para senhas (com tempo igualado quando o e-mail não existe), papéis admin/leitor, painel com resumo, coleta manual (cota mínima de 16 buscas, 1 h entre coletas) e auditoria. CLI `admin-criar` (senha sem eco). Front em `#/admin` carregado sob demanda. 233 testes no backend.
- **Erro de processo (registrado para não repetir):** dei commit encadeado sem conferir o resultado do pytest; um teste desatualizado ficou no commit. Corrigido num commit próprio. Regra daqui em diante: rodar a suíte e só depois commitar, em comandos separados.

- **Fase 8 (integrada).** `developer` = `4037dab`.
- **Fase 9 (integrada).** E2E de ponta a ponta nos três modos (arquivo, SQL e HTTP+OIDC): 25 de 25 localmente, e verde no GitHub Actions em runner Linux limpo. Falhas achadas e corrigidas pelo e2e: CORS sem credenciais (o cookie nunca era enviado em outra origem) e PUT/DELETE fora da lista de métodos. Também foram achados problemas do próprio teste (processo antigo na porta, consentimento já dado entre modos), corrigidos no harness.
- **Fase 10 (em andamento).** Tag `legado-pre-react` criada e publicada. Remoção de `frontend/`, `cadastro/` e `coletor/web/`, com README e comentários atualizados.
