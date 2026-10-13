# Progresso da execução autônoma (fonte da verdade para retomar)

Plano aprovado: [`PLANO.md`](PLANO.md). Regra de ouro: **nunca push na `main`**; tudo entra na `developer` e o Vinicius faz o merge.
Ao retomar (inclusive após limite de uso): leia este arquivo, `DIARIO.md` e `DECISOES-PENDENTES.md` e continue da primeira fase aberta até 100%.

Legenda: `[ ]` aberta · `[~]` em andamento · `[x]` concluída e integrada na `developer`.

| # | Fase | Branch | Estado | Último commit | Próximo passo |
|---|---|---|---|---|---|
| 0 | Documentação da execução + CI em todas as branches | `docs/execucao` | [x] | 775f8dd | commitar, push, CI verde, merge na `developer` |
| 1 | Organização do front + Vitest | `refactor/front-organizacao` | [x] | 56da119 (integrada na `developer`) | — |
| 2 | Núcleo da integração (config, cpf, sessão, auth demo, repositório, /api/me) | `feat/integracao-nucleo` | [x] | 2027207 (integrada na `developer`) | — |
| 3 | Provedores `sql` e `http`, CLI `doctor`, testes de contrato | `feat/integracao-provedores` | [x] | fe41b55 (integrada na `developer`) | — |
| 4 | Simulador da FSA (Postgres, API falsa, IdP falso) | `feat/simulador-fsa` | [~] | 39df7ce | CI verde, merge; depois a Fase 5 (login OIDC) |
| 5 | Login único OIDC | `feat/auth-oidc` | [x] | 3233222 (integrada na `developer`) | — |
| 6 | Front integrado (login real, consentimento, Perfil, Exceções, Certificados) | `feat/front-integracao` | [x] | feb1b9a (integrada na `developer`) | — |
| 7 | Currículo e marcações no servidor | `feat/curriculo-servidor` | [x] | 6f7eaf3 (integrada na `developer`) | — |
| 8 | Admin (API e tela) | `feat/admin` | [x] | 4037dab (integrada na `developer`) | — |
| 9 | e2e plug-and-play (3 modos só trocando variáveis) | `test/e2e-plug-and-play` | [ ] | — | — |
| 10 | Remover o legado (tag `legado-pre-react`) | `chore/remover-legado` | [x] | c881ded (integrada; tag `legado-pre-react`) | — |
| 11 | Documentação de adoção + ADRs + atualizações do TCC | `docs/adocao-fsa` | [x] | 9a8c54b (integrada) | — |
| 12 | Integração final, revisão de código e `MANHA.md` | `docs/execucao-final` | [~] | — | revisão independente de segurança (em curso), achados, `MANHA.md` |

## Estado do ambiente

- `developer` = `main` (8185732) no início. Produção intacta.
- Nada de segredos, IAM ou cobrança foi tocado. Nenhuma coleta real (SerpApi) foi feita.

## Como validar uma fase

```bash
cd coletor && .venv/Scripts/python.exe -m pytest -q          # backend
cd frontend-react && npm run lint && npm run build && npm test  # front
```
