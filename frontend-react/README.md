# StartMe — frontend React

Interface do aluno em React 18 + Vite + Tailwind CSS 4, sem outras dependências de execução.
Cobre o núcleo da jornada: portal simulado (Prancha 1), consentimento (3), início (4),
busca com triagem e detalhe (5 a 7) e meu currículo.

**O que o StartMe é:** reúne num só portal as vagas coletadas em portais definidos e indica ao aluno
o melhor match com o currículo dele. A candidatura e o processo seletivo acontecem no site de origem;
o StartMe não acompanha etapas. O currículo que o aluno monta aqui é o centro do produto: alimenta
o match e é exportado para os sites das empresas.

`frontend/` continua no repositório como referência das 13 pranchas em HTML/CSS/JS puro.
Perfil (9), exceções (10), sistema (11), currículo (12) e certificados (13) ainda não foram portados.

## Como rodar

```bash
cd frontend-react
npm install
cp .env.example .env.local     # ajuste as URLs dos backends, se necessário
npm run dev                    # http://localhost:5173
npm run build                  # gera dist/
```

Sem os backends no ar, a busca usa as vagas de demonstração de `src/data/mock.js` e avisa na tela.
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

## Estrutura

```
src/
  config.js                URLs dos backends (variáveis VITE_*)
  index.css                tokens da marca, botões, chips, animações
  data/mock.js             dados de demonstração (cópia de frontend/js/mock-data.js)
  lib/api.js               acesso ao coletor e ao cadastro, com timeout e fallback
  data/grade.js            grade de demonstração (disciplina → habilidades por semestre)
  data/requisitos.js       requisitos de demonstração das vagas mock
  data/curriculo-seed.js   currículo inicial do aluno de demonstração
  lib/match.js             perfil de habilidades, triagem, lacunas, vagas que mudaram
  lib/vagas.js             filtros, ordenação, formatação de salário
  lib/useMedia.js          hook de media query
  state/AppContext.jsx     estado, ações e sincronização com a URL
  components/Shell.jsx     barra superior, navegação inferior, toast
  components/Filtros.jsx   barra de filtros com popovers
  components/Triagem.jsx   medidor e veredito (compacto e completo)
  components/VagaCard.jsx  item de vaga
  components/Notas.jsx     painel de notas de design
  components/Icone.jsx     ícones de linha próprios
  views/                   Portal, Consent, Home, Lista (busca), Detalhe, Curriculo
```

Arquivos sem uso que podem ser apagados: `src/App.css` e `src/assets/` (modelo do Vite) e
`src/views/Candidaturas.jsx` (tela de acompanhamento removida em 07/10/2026).

## Pendências

- Os requisitos das vagas e a grade do curso são de demonstração. O match real depende de o coletor extrair
  requisitos estruturados dos anúncios e de a instituição fornecer a matriz curricular.
- Currículo, salvas e marcações ficam no navegador (localStorage). Faltam os endpoints
  `GET/PATCH /api/aluno/me` e `POST /api/aluno/curriculo`, e o envio real do arquivo de certificado.
- Importar currículo de PDF e exportar em outros formatos ficaram para depois.
- A tela de exceções (Prancha 10) não existe nesta versão: "Não autorizar" volta ao portal com aviso.
