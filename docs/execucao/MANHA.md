# Bom dia: o que foi feito e o que falta decidir

Plano completo: [`PLANO.md`](PLANO.md). Andamento e commits: [`PROGRESSO.md`](PROGRESSO.md). Diário: [`DIARIO.md`](DIARIO.md).
Decisões que pedem você: [`DECISOES-PENDENTES.md`](DECISOES-PENDENTES.md).

## O que está pronto (na `developer`)

- **Fases 0 a 11 integradas**, cada uma em sua branch, com CI verde antes do merge.
- **Plug-and-play provado:** o mesmo código roda com o arquivo de alunos, com a fonte SQL e com a fonte HTTP + login
  da FSA. Só mudam variáveis. O e2e com navegador passou nos três modos (25 de 25 verificações) e também no
  GitHub Actions, em runner Linux limpo (commit `1159aba`).
- **Front React completo:** telas do aluno (entrada, consentimento, início, vagas, detalhe, perfil, exceções,
  currículo, certificados) e o painel do administrador (`#/admin`). O HTML/JS antigo foi removido; está na tag
  `legado-pre-react`.
- **Currículo e marcações no servidor**, com controle de versão e migração automática do navegador.
- **Revisão de segurança independente:** 9 achados. Corrigidos os 5 de risco concreto (eco de dados no erro 422,
  dígitos fora do ASCII, corrida e memória no limite de tentativas, `iat` obrigatório). Os demais estão documentados.
- **Documentação:** `docs/ADOCAO-FSA.md` (adoção e checklist), `docs/SERVIDOR-FALSO-FSA.md` (simulador e como trocá-lo),
  e na pasta `tcc\documento`: ADR-003 (Azure para Google Cloud), ADR-004 (integração e Firestore) e
  `ATUALIZACOES-PARA-O-DOCUMENTO-TCC.md` (o que mudar na monografia).

## Verificado hoje

| Verificação | Resultado |
|---|---|
| Suíte do coletor | 239 testes passam (2 pulados: o arquivo local não tem como cair) |
| Testes do simulador | passam (rodam no CI) |
| Front: lint, build e Vitest | sem erro; 13 testes passam |
| Auditoria mobile | 78 combinações de tela e tamanho, sem estouro, sem alvo abaixo de 44 px |
| E2E nos três modos (local) | 25 de 25 |
| E2E no GitHub Actions | verde no commit `1159aba` |

**Pendente de confirmação:** a API do GitHub limitou as consultas no fechamento da noite, então não consegui checar o CI
e o e2e do commit final da `developer`. Confira na aba Actions. As últimas mudanças depois do `1159aba` são a remoção
do legado, a documentação e as correções de segurança (testadas localmente).

## Antes de publicar na `main` (isso dispara o deploy em produção)

1. Revisar o diff da `developer` contra a `main` (ou as branches uma a uma).
2. Fazer o merge `developer` → `main` quando estiver satisfeito. **Eu não fiz push na `main`.**
3. A produção hoje roda sem `SESSAO_SEGREDO`/`CPF_PEPPER` (`AUTH_MODE=demo`). Com essas variáveis ausentes o servidor
   responde 503 na sessão e o site usa o modo local, como antes. Não quebra nada, mas **o login pelo servidor só
   funciona depois de você criar os segredos**.

## Para ligar a produção à faculdade (quando a FSA estiver pronta)

1. Criar no Secret Manager `SESSAO_SEGREDO` e `CPF_PEPPER` (32+ caracteres aleatórios).
2. Escolher a fonte: `ACADEMICO_PROVIDER=sql` (view somente leitura) ou `http` (API da FSA).
3. Escolher o login: `AUTH_MODE=oidc` (com o cliente registrado na FSA) ou `demo`.
4. Validar com `python -m integracao.cli doctor --cpf <aluno de teste>` (sem imprimir dados pessoais).
5. Trocar `SIMULADO=false`.
6. Criar o primeiro administrador: `python -m integracao.cli admin-criar --email <e-mail> --papel admin`
   (a senha é pedida no terminal, sem eco).

## Coisas que só você pode fazer

- **Orientador:** levar os ADR-003 e ADR-004 e a lista de `ATUALIZACOES-PARA-O-DOCUMENTO-TCC.md`. A decisão de
  hospedagem muda a stack que o documento aprovado descreve.
- **TI da FSA:** perguntas em `docs/ADOCAO-FSA.md` (sistema acadêmico, API ou view, login institucional, autorização).
- **Segurança:** rotacionar a `SERPAPI_KEY` (ela foi colada no chat em outubro; ainda está pendente).
- **Custos:** conferir a fatura do Google na primeira semana. O custo estimado é centavos, mas são estimativas.
- **Decisões abertas** (todas em `DECISOES-PENDENTES.md`): conta de serviço única ou separada, limite por IP
  (depende de confiar no X-Forwarded-For do Cloud Run), Cloud SQL (custo fixo) e certificado em PDF.

## O que não foi feito (e por quê)

- **Não testei em aparelho real nem com leitor de tela.** Só emulação no Chrome.
- **Ensaio de carga (C4)** não foi executado.
- **CSRF no login da FSA** continua aberto (limitação documentada, risco baixo para um app de vagas).
- **Papel de admin e logout não revogam o token na hora** (valem até 2 h e 8 h). Documentado.
