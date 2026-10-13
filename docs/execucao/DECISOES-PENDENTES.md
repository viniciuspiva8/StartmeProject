# Decisões pendentes (para o Vinicius decidir)

Cada item: o que foi decidido provisoriamente, a alternativa e por quê. Itens marcados **[bloqueado]** esperaram permissão que o executor não tem.

## Já sabidas (antes de começar)

1. **Segredos novos em produção [bloqueado de propósito].** `SESSAO_SEGREDO` e `CPF_PEPPER` (e `OIDC_*` na adoção real) precisam ser criados no Secret Manager por você. Até lá, `/api/auth` e `/api/me` respondem 503 `sessao_desativada` e o site usa o fluxo demo local, então a produção não quebra.
2. **ADR-002 muda.** O banco "startme" em PostgreSQL vira Firestore (decisão do Vinicius, 13/10). O PostgreSQL fica só como `faculdade_sim` (simulação da FSA). Registrar no ADR-004 e avisar o orientador.
3. **CPFs de teste.** Os CPFs do seed (`111.444.777-35`, `529.982.247-25`, `123.456.789-09`) são exemplos públicos de documentação com dígito verificador válido, usados como fictícios. Não correspondem a pessoas reais conhecidas, mas qualquer CPF válido poderia, em tese, existir; o simulador nunca é exposto à internet.
4. **Retomada automática.** Ligar `autoContinueAtUsageLimit` em `/config` se quiser que a execução retome sozinha após o limite de uso.
5. **Admin inicial.** O primeiro administrador só é criado por você (`admin-criar`), com senha escolhida por você.

## Registradas durante a execução

8. **Candidaturas (prancha 8) não virou tela.** Saiu do produto em 07/10 (já estava decidido no README): a marcação "Já me candidatei" continua como filtro e anotação. Nada foi perdido para o aluno.
9. **Sistema (prancha 11) não virou tela do produto.** É a documentação do sistema de design do protótipo. Essa função é coberta pelo painel Notas de design e pelo `design-reference/`.
10. **CRUD do `cadastro/` (Node + MySQL) foi substituído.** Alunos e cursos vêm da faculdade (camada de integração); vagas vêm da coleta (Firestore). O cadastro antigo guardava CPF, RG, idade e data de nascimento: isso saiu junto, em linha com o item 4 do ADR-002 (minimização de dados).
11. **Legado removido com tag de recuperação.** `legado-pre-react` aponta para o último commit com os fronts antigos (`git checkout legado-pre-react` para consultar).
12. **CORS com credenciais (correção achada pelo e2e).** Com origens explícitas (nunca `*`), o cookie de sessão passa a ser aceito em desenvolvimento. Em produção nada muda: o Hosting mantém a mesma origem.
13. **E2E no GitHub Actions passou (Linux limpo).** O workflow `E2E` roda em push na `developer` e sob demanda, com Docker, emulador e Chrome instalados no runner.
14. **Limitação do login da FSA por CSRF (item 6).** Continua aberta; aceitável para o escopo do TCC.

6. **Login CSRF no OIDC (fase 5).** O `state` é assinado, mas não fica preso ao navegador (o Hosting só repassa o cookie `__session`). Um atacante poderia levar a vítima a concluir um login com a conta do atacante. Risco baixo para um app de vagas; a correção completa exige um cookie de amarração próprio, que o Hosting hoje não repassa.
7. **Cobertura do CI.** Os testes do simulador (`simulador-fsa/tests`) ainda não rodam no CI. Entram na Fase 9 (e2e), junto com as dependências `cryptography` e `python-multipart`.

15. **Revisão independente de segurança (fase 12).** Um revisor somente leitura, sem acesso às minhas conclusões, apontou 9 achados. Corrigidos: eco de CPF e senha no erro 422; dígitos fora do ASCII; corrida e crescimento de memória no limite de tentativas; `iat` obrigatório no id_token. Documentados como limitação: CSRF no login da FSA (item 6), papel de admin válido até 2 h, logout sem revogação do token, lista negra de SQL (a proteção real é usuário somente leitura).
16. **Limite global por IP não foi aplicado.** No Cloud Run, o IP visto pela aplicação pode ser o do proxy do Google; um limite por IP bloquearia todo mundo. Decidir com o orientador se vale configurar o cabeçalho X-Forwarded-For confiável antes de qualquer limite por IP.
17. **Verificação final em aberto.** A API do GitHub estava limitando consultas sem autenticação no fechamento da noite; o último e2e verificado no GitHub é o da `developer` em `1159aba`. Conferir o CI e o e2e da `developer` após o merge final.
