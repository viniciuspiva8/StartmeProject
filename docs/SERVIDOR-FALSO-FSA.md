# O servidor falso da FSA (simulador)

Como a simulação funciona, como rodar, e exatamente o que trocar para ligar ao sistema real da faculdade.
A simulação existe para **provar** o plug-and-play: a mesma aplicação roda contra a simulação e contra a
FSA, só mudando variáveis. Os dados são fictícios. Não exponha este servidor na internet.

## As peças

| Peça | Porta | O que faz | Para que serve na adoção |
|---|---|---|---|
| `postgres` (faculdade_sim) | 5433 | banco com curso, aluno e a view `vw_startme` | modelo de uma **view somente leitura** (provedor `sql`) |
| `api` | 8101 | API REST no formato de um ERP (`/fsa/alunos/{cpf}/vinculo`) com chave de API | modelo de **API REST** (provedor `http`), com um formato diferente do contrato de propósito |
| `idp` | 8102 | login OpenID Connect com PKCE, RS256 e JWKS | modelo do **login institucional** (modo `oidc`) |

O formato da API é propositalmente diferente do contrato do StartMe (`Aluno.Situacao: "Matriculado"` em vez de
`ativo: true`). Isso prova que o **mapa de resposta** (`ACADEMICO_HTTP_MAPA`) faz a tradução, e que não é preciso
mudar o código para lidar com a forma da resposta da faculdade.

## Como rodar

```bash
cd simulador-fsa
docker compose up --build -d
curl -H "X-API-Key: chave-de-teste-fsa" http://localhost:8101/fsa/alunos/11144477735/vinculo
curl http://localhost:8102/.well-known/openid-configuration
docker compose down -v      # apaga o banco (é só simulação)
```

Cada serviço tem limite de memória (cerca de 130 MB no total). As migrações de banco são aplicadas na subida,
uma vez cada, e registradas em `schema_migrations`.

## Dados de teste

| CPF | Situação | Curso | Semestre | Uso |
|---|---|---|---|---|
| `111.444.777-35` | ativo | Engenharia de Computação | 7 | caso feliz |
| `529.982.247-25` | ativo | Ciência da Computação | 3 | outro curso |
| `123.456.789-09` | trancado | Engenharia de Computação | 4 | recusa por vínculo inativo |
| `000.000.000-00` | ativo | Engenharia de Computação | 7 | demonstração do TCC (sem dígito verificador) |

Os CPFs de teste têm dígitos verificadores válidos porque são exemplos públicos de documentação. Não pertencem a
pessoas conhecidas.

## Validar a integração

```bash
cd coletor
.venv/bin/python -m integracao.cli doctor --cpf 111.444.777-35
```

Com o simulador no ar e as variáveis do modo desejado, o `doctor` confirma a configuração, a sessão, a fonte e o
vínculo do aluno. Os testes automáticos cobrem os três provedores com a mesma suíte (contrato) e o IdP com
verificação de assinatura pelo JWKS.

## Do simulador para a FSA real: o que trocar

| Peça | Simulação | FSA real | Variável |
|---|---|---|---|
| Fonte SQL | `postgresql+psycopg://fsa:…@postgres:5432/faculdade_sim` | banco ou view da FSA, somente leitura | `ACADEMICO_SQL_URL`, `ACADEMICO_SQL_CONSULTA` |
| Fonte HTTP | `http://localhost:8101/fsa/alunos/{cpf}/vinculo` | endpoint de vínculo da FSA (https) | `ACADEMICO_HTTP_URL` |
| Autenticação da fonte HTTP | `X-API-Key: chave-de-teste-fsa` | chave ou token da FSA | `ACADEMICO_HTTP_CABECALHOS` |
| Mapa da resposta | `Aluno.Situacao` = `Matriculado` | caminho e valores reais da FSA | `ACADEMICO_HTTP_MAPA` |
| Formato do CPF | só dígitos | o que a FSA espera (`digitos` ou `pontuado`) | `ACADEMICO_CPF_FORMATO` |
| Login | IdP simulado (`idp`) | IdP institucional (OpenID Connect) | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` |
| Nome do claim do CPF | `cpf` | o claim real | `OIDC_CPF_CLAIM` |
| Segredos | valores de teste no compose | Secret Manager | `SESSAO_SEGREDO`, `CPF_PEPPER`, `OIDC_CLIENT_SECRET`, chave da FSA |
| Ambiente | `AMBIENTE=local` | ausente (cookie `Secure`, https obrigatório) | `AMBIENTE` |

Regras que o sistema impõe e que valem na troca:

- URL de fonte HTTP sem `https` é **recusada** na subida (exceto com `AMBIENTE=local`).
- Autenticação HTTP (se a FSA validar a senha por API) também exige `https`, porque a senha trafega nela.
- Consulta SQL precisa ser **um único SELECT com `:cpf`**, sem comando de escrita.
- O `ACADEMICO_HTTP_MAPA` precisa informar `curso`, `semestre` e `ativo`; `nome` é opcional.
- Resposta da FSA fora do formato esperado vira "fonte indisponível" (503), e não dado inventado.

## Teste de aceitação antes de ligar a FSA

1. `doctor` com um aluno ativo: `[ok] vínculo ativo`.
2. `doctor` com um aluno trancado: `[falhou] vínculo inativo`, código 1.
3. `doctor` com um CPF que não existe: `aluno sem vínculo nesta fonte`.
4. Derrubar a fonte (ou usar uma URL errada): `fonte acadêmica não respondeu`, sem vazar o CPF no log.
5. Login real com um aluno de teste da FSA, da tela de entrada até o início, e conferir `GET /api/me`.
6. Revogar o consentimento e conferir que o currículo sumiu.
