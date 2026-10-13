# Progresso da execução autônoma (fonte da verdade para retomar)

Plano aprovado: [`PLANO.md`](PLANO.md). Regra de ouro: **nunca push na `main`**; tudo entra na `developer` e o Vinicius faz o merge.
Ao retomar (inclusive após limite de uso): leia este arquivo, `DIARIO.md` e `DECISOES-PENDENTES.md` e continue da primeira fase aberta até 100%.

Legenda: `[ ]` aberta · `[~]` em andamento · `[x]` concluída e integrada na `developer`.

| # | Fase | Branch | Estado | Último commit | Próximo passo |
|---|---|---|---|---|---|
| 0 | Documentação da execução + CI em todas as branches | `docs/execucao` | [x] | 775f8dd | commitar, push, CI verde, merge na `developer` |
| 1 | Organização do front + Vitest | `refactor/front-organizacao` | [ ] | — | dividir `Curriculo.jsx` e `AppContext.jsx` |
| 2 | Núcleo da integração (config, cpf, sessão, auth demo, repositório, /api/me) | `feat/integracao-nucleo` | [ ] | — | — |
| 3 | Provedores `sql` e `http`, CLI `doctor`, testes de contrato | `feat/integracao-provedores` | [ ] | — | — |
| 4 | Simulador da FSA (Postgres, API falsa, IdP falso) | `feat/simulador-fsa` | [ ] | — | — |
| 5 | Login único OIDC | `feat/auth-oidc` | [ ] | — | — |
| 6 | Front integrado (login real, consentimento, Perfil, Exceções, Certificados) | `feat/front-integracao` | [ ] | — | — |
| 7 | Currículo e marcações no servidor | `feat/curriculo-servidor` | [ ] | — | — |
| 8 | Admin (API e tela) | `feat/admin` | [ ] | — | — |
| 9 | e2e plug-and-play (3 modos só trocando variáveis) | `test/e2e-plug-and-play` | [ ] | — | — |
| 10 | Remover o legado (tag `legado-pre-react`) | `chore/remover-legado` | [ ] | — | — |
| 11 | Documentação de adoção + ADRs + atualizações do TCC | `docs/adocao-fsa` | [ ] | — | — |
| 12 | Integração final, revisão de código e `MANHA.md` | `developer` | [ ] | — | — |

## Estado do ambiente

- `developer` = `main` (8185732) no início. Produção intacta.
- Nada de segredos, IAM ou cobrança foi tocado. Nenhuma coleta real (SerpApi) foi feita.

## Como validar uma fase

```bash
cd coletor && .venv/Scripts/python.exe -m pytest -q          # backend
cd frontend-react && npm run lint && npm run build && npm test  # front
```
