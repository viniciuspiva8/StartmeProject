# Faculdade simulada (FSA falsa)

Simula, em contêineres locais, a faculdade que o StartMe vai integrar. **Todos os dados são fictícios.**
Serve para provar que a integração funciona de ponta a ponta e para mostrar, na banca, como a troca
por uma fonte real acontece (só variáveis de ambiente).

## Peças

| Peça | Porta | O que é |
|---|---|---|
| `postgres` | 5433 | Banco `faculdade_sim` com migrações versionadas (`migrations/`) e a view `vw_startme` |
| `api` | 8101 | API acadêmica no formato **próprio** da FSA (não é o contrato do StartMe) |
| `idp` | 8102 | Login OIDC mínimo (code + PKCE, RS256, JWKS). Contas de teste, senha `senha` |

## Como rodar

```bash
cd simulador-fsa
docker compose up --build -d
curl -H "X-API-Key: chave-de-teste-fsa" http://localhost:8101/fsa/alunos/11144477735/vinculo
curl http://localhost:8102/.well-known/openid-configuration
docker compose down -v      # apaga o banco (é só simulação)
```

Testes (rodam sem Docker):

```bash
../coletor/.venv/Scripts/python.exe -m pytest tests -q
```

## Contas de teste

| CPF | Situação | Curso | Semestre |
|---|---|---|---|
| `111.444.777-35` | ativo | Engenharia de Computação | 7 |
| `529.982.247-25` | ativo | Ciência da Computação | 3 |
| `123.456.789-09` | **trancado** | Engenharia de Computação | 4 |
| `000.000.000-00` | ativo (demonstração do TCC) | Engenharia de Computação | 7 |

Os CPFs têm dígitos verificadores válidos porque são exemplos públicos de documentação. Não correspondem a
pessoas conhecidas. **Não exponha este serviço na internet** (a chave da API e as senhas são de teste).

## Trocar a simulação pela fonte real

O StartMe escolhe a fonte por variáveis. Em desenvolvimento, para apontar ao simulador:

```bash
ACADEMICO_PROVIDER=http
ACADEMICO_HTTP_URL=http://localhost:8101/fsa/alunos/{cpf}/vinculo
ACADEMICO_HTTP_CABECALHOS={"X-API-Key":"chave-de-teste-fsa"}
ACADEMICO_HTTP_MAPA={"nome":"Aluno.Nome","curso":"Matricula.Curso.Nome","semestre":"Matricula.PeriodoAtual","ativo":{"caminho":"Aluno.Situacao","em":["Matriculado"]}}
AMBIENTE=local
```

Para a FSA real, troque `ACADEMICO_HTTP_URL`, o cabeçalho e o mapa pelos da API da FSA (ou use
`ACADEMICO_PROVIDER=sql` com uma view somente leitura). Verifique com:

```bash
cd coletor && .venv/Scripts/python.exe -m integracao.cli doctor --cpf <CPF de um aluno de teste>
```
