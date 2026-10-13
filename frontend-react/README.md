# StartMe — frontend React

Interface do aluno e painel do administrador em React 18 + Vite + Tailwind CSS 4, sem outras dependências de execução.
Cobre a jornada completa: portal (Prancha 1), consentimento (3), início (4), busca com triagem e detalhe (5 a 7),
perfil (9), exceções (10), currículo (12), certificados (13) e o painel do administrador (`#/admin`).

**O que o StartMe é:** reúne num só portal as vagas coletadas em portais definidos e indica ao aluno
o melhor match com o currículo dele. A candidatura e o processo seletivo acontecem no site de origem;
o StartMe não acompanha etapas. O currículo que o aluno monta aqui é o centro do produto: alimenta
o match e é exportado para os sites das empresas.

Desde 13/10/2026 este é o único front. O código em HTML/JS puro das 13 pranchas foi removido; está na tag `legado-pre-react`.
Perfil (9), exceções (10), currículo (12) e certificados (13) estão aqui. Candidaturas (8) saiu do produto em 07/10 (ver seção Decisões). Sistema (11) é a documentação do sistema de design do protótipo, não uma tela do produto.

## Como rodar

```bash
cd frontend-react
npm install
cp .env.example .env.local     # VITE_COLETOR_URL: endereço do coletor (padrão http://localhost:8000)
npm run dev                    # http://localhost:5173
npm run build                  # gera dist/
npm run lint && npm test       # oxlint e Vitest
```

Em produção o front é publicado no Firebase Hosting, que repassa `/api/**` ao coletor no Cloud Run (mesma origem).

**Com o servidor e sessão ativos** (`GET /api/publico/config` com `sessao_ativa: true`), o login, o consentimento,
os dados acadêmicos (do vínculo informado pela faculdade), o currículo e as marcações vêm do servidor. **Sem servidor
ou sem sessão**, o front segue no modo local de demonstração: vagas de `src/data/mock.js` quando o coletor não
responde, dados acadêmicos fictícios e currículo no navegador, com aviso na tela.
Credenciais de demonstração: CPF `000.000.000-00` (pode digitar só os zeros), senha `senha`.

## Currículo e match (v3, 07/10/2026)

**Match currículo × vaga, recalculado ao vivo.** `src/lib/match.js` monta o perfil do aluno a partir de quatro
fontes, guardando a origem de cada habilidade: disciplinas cursadas até o semestre atual (grade de demonstração
em `src/data/grade.js`), certificações, atividades acadêmicas e voluntariado, e habilidades declaradas. Cada vaga
tem requisitos obrigatórios, desejáveis e condições (`src/data/requisitos.js`, de demonstração). O detalhe mostra
de onde vem cada requisito atendido ("pelo certificado Fundamentos de SQL") e oferece "Eu sei Excel" para o que
falta. "Eu sei X" não grava direto: leva ao currículo com o formulário da habilidade aberto e o nome preenchido,
onde o aluno informa nível (básico, intermediário, avançado), onde aprendeu, ano e, se quiser, anexa o certificado
(com certificado, a habilidade conta como comprovada). Ao salvar, a avaliação é refeita no navegador, um aviso diz
quantas vagas mudaram e oferece voltar para a vaga de onde o aluno saiu.

**Meu currículo** (`#/curriculo`): dados do Portal Acadêmico (não editáveis), contato, resumo, habilidades
(da grade, comprovadas e declaradas), certificações (com arquivo opcional, só o nome é guardado), atividades
acadêmicas e voluntariado, idiomas. Ao lado, a prévia "como a empresa vê", que é o que sai em **Exportar PDF**
(impressão do navegador, A4, só a prévia é impressa). No desktop a prévia fica presa ao lado do editor e tem
rolagem própria, separada da página.

**"Já me candidatei"** é só uma anotação do aluno na vaga, sem etapas. Salvas e candidatadas viram um filtro
("Minhas marcações") e ficam guardadas no navegador. O endereço antigo `#/candidaturas` leva ao currículo.

**Início:** além das vagas indicadas, mostra as habilidades obrigatórias mais pedidas que faltam no currículo
e o que falta para ele ficar completo.

## Decisões de interface (v2, 07/10/2026)

**Triagem antes de tudo.** A busca responde primeiro "vale a pena abrir esta vaga?". Cada vaga mostra
um medidor em que cada segmento é um requisito (verde-água quando bate com o curso e o semestre,
âmbar quando é ressalva), o veredito em texto ("Vale o seu tempo", "Vale, com ressalvas",
"Provavelmente não") e a principal ressalva. O percentual de compatibilidade saiu: era um número
sem regra definida. Vagas reais do coletor, que não trazem requisitos, ficam como "Sem dados para avaliar".

**Lista no centro, detalhe sob demanda** (ajuste de 08/10/2026). A lista ocupa o centro da tela e cada
cartão mostra o necessário para decidir: veredito, principal ressalva, salário, modalidade, data de coleta e os
requisitos marcados contra o currículo. Ao clicar, a lista vira uma coluna à esquerda e o detalhe abre ao lado;
fechar (botão, Esc ou Voltar do navegador) devolve a lista ao centro. Abaixo de 1024 px, o detalhe abre em tela cheia.

**Filtros em linha.** Busca, atalho "Combina com o meu semestre" e os demais filtros em botões
que abrem uma lista de opções. No celular, a linha rola na horizontal.

**Identidade do Manual da Marca da FSA.** Azul institucional `#042D5C` e variações, verde-água
`#00A699` e variações, preto `#161A1F`/`#2D3144`, brancos `#F8F8F8`/`#EBF1FF`. Georgia nos títulos,
Montserrat no restante. Tons derivados para texto foram escurecidos até contraste AA (ver `src/index.css`).

**Práticas atuais adotadas.** Rotas na URL (`#/vagas/v3`: o Voltar do navegador funciona e uma vaga
pode ser compartilhada); View Transitions API na troca de vaga, com `prefers-reduced-motion` respeitado;
container queries no painel de detalhe; skeleton de carregamento; aviso flutuante (toast) no lugar de
modal; navegação inferior no celular; item de lista inteiro clicável; foco visível e rótulos para leitor de tela.

**Notas de design.** O botão "Notas de design" abre um painel com a decisão e o porquê de cada tela,
para a monografia e a banca.

## Logo

O logo oficial está em `design-reference/logo/StartMe_logo_vetorizada.svg` (sem alteração). Em `public/` ficam
dois recortes do mesmo desenho, que só mudam o `viewBox` (o original tem muita margem vazia):
`logo-startme.svg` (símbolo + "StartMe", só vale a partir de ~96 px de altura) e `logo-startme-simbolo.svg`
(só o símbolo, usado no favicon, na barra superior, no consentimento e no atalho do portal).
O componente `src/components/Logo.jsx` aplica os dois. O texto "Start" e a ponta esquerda do símbolo têm a cor do
cabeçalho (`#042D5C`), então sobre fundo azul o símbolo vai num chip branco.

## Estrutura

```
src/
  config.js                URL do coletor (VITE_COLETOR_URL)
  index.css                tokens da marca, botões, chips, animações
  App.jsx                  troca de telas por rota; o painel admin é carregado sob demanda
  data/mock.js             dados de demonstração (vagas, dados acadêmicos fictícios)
  data/grade.js            grade de demonstração (disciplina → habilidades por semestre)
  data/requisitos.js       requisitos de demonstração das vagas mock
  data/curriculo-seed.js   currículo inicial do aluno de demonstração
  lib/api.js               vagas do coletor, com timeout e fallback; links seguros; localStorage
  lib/apiAluno.js          rotas do aluno e do admin (/api/auth, /api/me, /api/admin), com cookie de sessão
  lib/cpf.js               validação e máscara de CPF
  lib/match.js             perfil de habilidades, triagem, lacunas, vagas que mudaram
  lib/vagas.js             filtros, ordenação, formatação de salário
  lib/useMedia.js          hook de media query
  lib/*.test.js            testes Vitest (cpf, match, vagas)
  state/AppContext.jsx     estado, ações, descoberta do servidor e sincronização com a URL
  state/constantes.js      rotas, chaves de armazenamento, filtros
  state/utilitarios.js     estado inicial e dados acadêmicos de demonstração
  state/sincronizaServidor.js   envia currículo e marcações ao servidor (versão otimista)
  components/              Shell (barra, navegação, toast), Filtros, Triagem, VagaCard, Notas, Logo, Icone
  views/                   Portal, Consent, Home, Lista, Detalhe, Perfil, Excecoes, Certificados, Admin
  views/Curriculo.jsx      tela do currículo; partes em views/curriculo/
```

## Pendências

- Os requisitos das vagas e a grade do curso são de demonstração. O match real depende de o coletor extrair
  requisitos estruturados dos anúncios e de a instituição fornecer a matriz curricular.
- O envio real do arquivo de certificado não existe: os certificados ficam só na tela e no navegador.
- Importar currículo de PDF e exportar em outros formatos ficaram para depois.
- Testado em emulação de dispositivos móveis, não em aparelhos reais nem com leitor de tela.
