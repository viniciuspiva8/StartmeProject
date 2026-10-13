# Adoção do StartMe pela FSA

O StartMe foi desenhado para ser adotado **sem mudar código**: a faculdade troca a fonte de dados e o login
por variáveis de ambiente. Este documento diz quais são, como validar e o que a TI precisa confirmar.

Base: ADR-002 (camada de integração e contrato mínimo) e ADR-004 (integração e Firestore).

## O que o StartMe precisa da faculdade

Só três coisas, por aluno, e **nunca** o CPF na resposta:

| Dado | Uso |
|---|---|
| vínculo ativo (sim/não) | libera o acesso; trancado ou inexistente recebe a tela "vínculo não ativo" |
| curso | compatibilidade das vagas com o currículo |
| semestre | compatibilidade das vagas e o cabeçalho da tela |
| nome (opcional) | saudação; pode vir vazio |

Não são usados: notas, histórico, financeiro, RG, matrícula, data de nascimento, endereço.

## Três modos, lado a lado

A mesma aplicação roda nos três. Só mudam estas variáveis (Secret Manager em produção):

| Variável | Demonstração (hoje) | Fonte SQL + login demo | Adoção real (HTTP + login FSA) |
|---|---|---|---|
| `AUTH_MODE` | `demo` | `demo` | `oidc` |
| `ACADEMICO_PROVIDER` | `arquivo` | `sql` | `http` |
| `ACADEMICO_SQL_URL` | — | URL somente leitura (view) | — |
| `ACADEMICO_HTTP_URL` | — | — | endpoint da FSA com `{cpf}` |
| `ACADEMICO_HTTP_CABECALHOS` | — | — | chave de API da FSA |
| `ACADEMICO_HTTP_MAPA` | — | — | como ler a resposta da FSA |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` | — | — | login institucional da FSA |
| `OIDC_CPF_CLAIM` | — | — | nome do claim que traz o CPF (padrão `cpf`) |
| `SIMULADO` | `true` | `true` | `false` (some a faixa "ambiente simulado") |
| `SESSAO_SEGREDO`, `CPF_PEPPER` | obrigatórias | obrigatórias | obrigatórias (32+ bytes, aleatórias) |

Todas as variáveis estão em `coletor/integracao/config.py` (com a validação na subida) e em
`coletor/.env.example`. Configuração inválida **impede a subida** do serviço, com a mensagem do erro.

O exemplo completo do modo HTTP está em `e2e/run.mjs` (modo `http-oidc`), que roda no GitHub Actions a cada push na `developer`.

## Checklist de adoção

1. **Confirmar com a TI da FSA** (lista na seção seguinte).
2. **Escolher a fonte.** Se houver uma view somente leitura no banco, use `ACADEMICO_PROVIDER=sql`. Se houver
   API REST, use `http`. Nunca dê ao StartMe acesso de escrita a nada da faculdade.
3. **Escolher o login.** Se o portal institucional for OpenID Connect, use `oidc` e peça o registro do cliente
   (client id, secret e redirect `https://<site>/api/auth/oidc/retorno` na lista autorizada do IdP). Sem OIDC,
   o modo `demo` **não** deve ir para produção com alunos reais: ele aceita só o CPF de demonstração.
4. **Criar os segredos** no Secret Manager: `SESSAO_SEGREDO`, `CPF_PEPPER` e, se for o caso, `OIDC_CLIENT_SECRET`
   e a chave da API da FSA. Nunca no código nem no `.env` versionado.
5. **Validar antes de abrir ao público:**
   ```bash
   cd coletor && .venv/bin/python -m integracao.cli doctor --cpf <CPF de um aluno de teste da FSA>
   ```
   O comando confere a configuração, a sessão, a fonte acadêmica e o vínculo desse aluno, sem imprimir CPF,
   nome ou segredo. Ele sai com código 1 se algo falhar.
6. **Trocar `SIMULADO=false`** e confirmar que a faixa de ambiente simulado sumiu.
7. **Criar o primeiro administrador** (senha escolhida por quem administra; mínimo de 12 caracteres):
   ```bash
   GOOGLE_CLOUD_PROJECT=<projeto> .venv/bin/python -m integracao.cli admin-criar --email <e-mail> --papel admin
   ```
8. **Desligar o que é de demonstração:** o CPF de demonstração (`DEMO_CPF`) só existe no modo `demo`.

## Perguntas para a TI da FSA

- Qual sistema acadêmico é usado (TOTVS RM Educacional ou outro) e em qual versão?
- Existe API REST ou SOAP habilitada para consultar o vínculo? Qual o formato da resposta?
- Existe uma view ou acesso somente leitura que o StartMe possa consultar? Quem a mantém?
- O login institucional é OpenID Connect? Qual o issuer, e como o CPF aparece no token?
- Como o sistema identifica o aluno (RA, matrícula, CPF)? O CPF é o identificador estável?
- Qual o tempo de resposta e o limite de chamadas aceitável?
- Há autorização institucional formal para a integração? Quem assina?
- Qual o período de retenção de dados de aluno que a FSA exige? (O StartMe não guarda dados acadêmicos além do vínculo na sessão.)
- Qual é o endereço de contato para o encarregado de dados (LGPD) da FSA?

## Segurança e LGPD (o que o sistema já faz)

- **Minimização:** o contrato tem quatro campos. Nenhuma rota devolve CPF, e o token de sessão não tem CPF
  (só o hash pseudônimo e a máscara `***.456.789-**`). Testes verificam isso em respostas, logs, token e auditoria.
- **Consentimento versionado:** o aluno aceita um termo com versão (`TERMO_VERSAO`). Revogar apaga currículo e
  marcações e guarda só a data da revogação. Apagar a conta apaga tudo.
- **Auditoria sem dados pessoais:** eventos com o prefixo do hash do aluno ou o e-mail do administrador.
- **Cookie de sessão:** `HttpOnly`, `Secure` em produção, `SameSite=Lax`, validade de 8 h (aluno) e 2 h (admin).
- **Login pela FSA:** PKCE (S256), `state` assinado, `nonce`, assinatura RS256 verificada pelas chaves do IdP,
  checagem de `iss`, `aud`, `exp`, `iat`. Ataques cobertos por testes (algoritmo `none`, audiência trocada, token expirado).
- **Senhas de administrador:** argon2. Erro idêntico para e-mail inexistente e senha errada.

## Limitações conhecidas

- **Login da FSA sem amarração ao navegador.** Um atacante poderia induzir a vítima a concluir o login com a
  conta dele (CSRF de login). O `state` é assinado, mas não fica preso ao navegador, porque o Firebase Hosting
  só repassa o cookie `__session`. Risco baixo para um app de vagas; correção completa depende de um cookie
  próprio que o Hosting repasse.
- **Papel e cadastro do administrador valem por até 2 horas.** A sessão de admin carrega o papel no token; rebaixar ou
  desativar um administrador só vale quando a sessão expira. Aceitável para a equipe pequena do projeto.
- **Revogação de sessão do aluno.** O logout remove o cookie do navegador; uma cópia do token vale até as 8 horas.
- **Cookie único para aluno e administrador.** Ambos usam `__session`, com audiências diferentes. Quem entrar
  como administrador e depois como aluno no mesmo navegador troca a sessão. Sem risco de acesso cruzado.
- **Limite de tentativas em memória por instância.** Com várias instâncias do Cloud Run, o limite é por instância.
  Suficiente para o escopo; trocar por armazenamento compartilhado se o tráfego crescer.
- **Sem transação no Firestore para o currículo.** O controle de versão cobre o caso comum; a corrida só existe
  se a mesma conta editar em duas abas ao mesmo tempo.
- **Provedor SQL:** a consulta é validada (um único SELECT com `:cpf`) por uma lista de termos proibidos, que não
  é uma barreira completa (ex.: `SELECT ... INTO` passaria). **A proteção real é um usuário de banco somente leitura**,
  com permissão apenas na view. Exigir isso na adoção.
- **O servidor de demonstração não é para a internet.** O `simulador-fsa` tem chaves e senhas de teste.
