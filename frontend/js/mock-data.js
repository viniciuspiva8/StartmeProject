// DADOS MOCK — ver README (seção "Frontend v1.1 (mesclado)") para o que é real vs mockado.
//
// Este arquivo é a versão portada, em JS puro, dos dados que existiam dentro do
// <script data-dc-script> do protótipo proprietário (design-reference/StartMe.dc.html).
// Nada aqui fala com nenhum backend: é o conteúdo de demonstração da jornada do
// aluno (textos em português, empresas fictícias, candidaturas fictícias etc.).
//
// Campos como `modalidade`, `area`, `semestreMin`, `pct`, `criterios` e `razao`
// dentro de VAGAS não existem na coleta real (coletor/main.py só devolve
// id/titulo/empresa/link/data_coleta/descricao/salario). Eles ilustram uma
// feature de "compatibilidade" que ainda não tem regra de cálculo definida
// pelo time — a Prancha 6 do design original já expõe esse aviso na tela de
// detalhe da vaga, e o mantemos (ver views.js, renderDetalhe).
"use strict";

// Vagas de demonstração (usadas quando o coletor está fora do ar, ou como base
// para enriquecer vagas reais vindas de GET /api/vagas — ver js/api.js).
const VAGAS = [
  { id: 'v1', titulo: 'Estagiário de Desenvolvimento Back-end Python', empresa: 'Nexus Sistemas', link: 'https://www.ciadeestagios.com.br/vaga/back-end-python', salario: 'R$ 1.800,00', dias: 0, dataColeta: '05/09/2026, 06:00 (UTC)', modalidade: 'Híbrido', area: 'Desenvolvimento', semestreMin: 5, pct: 92,
    razao: 'Pede Python e SQL, ambos na sua grade desde o 3º semestre',
    criterios: [
      { texto: 'Pede Python, presente no seu curso a partir do 3º semestre', positivo: true },
      { texto: 'Pede noções de banco relacional — Banco de Dados I concluída no 4º semestre', positivo: true },
      { texto: 'Aceita estágio de 6 horas, compatível com curso noturno', positivo: true },
      { texto: 'Menciona Docker, que só aparece na grade no 9º semestre', positivo: false }
    ],
    descricao: 'Estágio em squad de plataforma. Você vai atuar na manutenção de APIs REST em Python (FastAPI), escrever consultas SQL e participar das revisões de código junto aos desenvolvedores plenos.\n\nRequisitos:\n- cursando Engenharia/Ciência da Computação ou Análise e Desenvolvimento de Sistemas, a partir do 4º semestre\n- lógica de programação e Python\n- noções de SQL\n\nDesejável: Git, Docker, testes automatizados.\n\nBenefícios: bolsa-auxílio, vale-transporte, vale-refeição, 6h/dia, possibilidade de efetivação.' },

  { id: 'v2', titulo: 'Estágio em Análise de Dados', empresa: 'Grupo Vertere', link: 'https://www.ciadeestagios.com.br/vaga/analise-dados', salario: '1500-2000', dias: 1, dataColeta: '04/09/2026, 06:00 (UTC)', modalidade: 'Presencial', area: 'Dados', semestreMin: 4, pct: 84,
    razao: 'Pede SQL e Excel avançado, cobertos até o 4º semestre',
    criterios: [
      { texto: 'Pede SQL, presente no seu curso a partir do 4º semestre', positivo: true },
      { texto: 'Pede estatística descritiva — Probabilidade e Estatística concluída no 5º semestre', positivo: true },
      { texto: 'Presencial em São Bernardo do Campo, sem informação de turno na origem', positivo: false }
    ],
    descricao: 'Apoio ao time de BI na construção de relatórios gerenciais. Rotina: extração de dados em SQL, tratamento em planilhas e manutenção de painéis no Power BI.\n\nSalário informado na origem como faixa: 1500-2000.' },

  { id: 'v3', titulo: 'Jovem Aprendiz — Suporte de Infraestrutura', empresa: 'Tecnolar Distribuidora', link: 'https://www.ciadeestagios.com.br/vaga/aprendiz-infra', salario: '', dias: 2, dataColeta: '03/09/2026, 06:00 (UTC)', modalidade: 'Presencial', area: 'Infraestrutura', semestreMin: 1, pct: 61,
    razao: 'Programa de aprendiz: sem exigência técnica, mas abaixo do seu semestre',
    criterios: [
      { texto: 'Não exige experiência prévia nem semestre mínimo', positivo: true },
      { texto: 'Programa de aprendiz costuma priorizar quem está nos primeiros semestres — você está no 7º', positivo: false },
      { texto: 'Escala 5x2 em horário comercial integral, incompatível com curso noturno de 10 semestres', positivo: false }
    ],
    descricao: '' },

  { id: 'v4', titulo: 'Estagiário de QA — Testes Manuais', empresa: 'Órbita Software', link: 'https://www.ciadeestagios.com.br/vaga/qa-manual', salario: 'A combinar', dias: 2, dataColeta: '03/09/2026, 06:00 (UTC)', modalidade: 'Remoto', area: 'QA', semestreMin: 3, pct: 78,
    razao: 'Pede lógica e escrita de casos de teste, sem tecnologia fora da sua grade',
    criterios: [
      { texto: 'Não exige experiência prévia em QA', positivo: true },
      { texto: 'Pede noções de banco de dados e API, cobertas no 4º e 6º semestres', positivo: true },
      { texto: 'Salário declarado como "A combinar" — impossível avaliar a compatibilidade financeira', positivo: false }
    ],
    descricao: 'Execução de casos de teste manuais em produto SaaS, registro de defeitos em Jira e apoio à documentação de regressão.\n\nRemoto com um encontro presencial mensal em São Caetano do Sul.\n\nSalário: A combinar.' },

  { id: 'v5', titulo: 'Estágio em Desenvolvimento Front-end React', empresa: 'Pilar Digital', link: 'https://www.ciadeestagios.com.br/vaga/front-react', salario: 'R$ 2.100,00', dias: 0, dataColeta: '05/09/2026, 06:00 (UTC)', modalidade: 'Remoto', area: 'Desenvolvimento', semestreMin: 5, pct: 88,
    razao: 'Pede JavaScript e HTML/CSS, na sua grade desde o 2º semestre',
    criterios: [
      { texto: 'Pede JavaScript, HTML e CSS — Programação para Web concluída no 2º semestre', positivo: true },
      { texto: 'React é desejável, não obrigatório', positivo: true },
      { texto: 'Pede Git, presente nas disciplinas de projeto a partir do 5º semestre', positivo: true },
      { texto: 'Menciona TypeScript, ausente da grade do curso', positivo: false }
    ],
    descricao: 'Estágio na squad de produto. Implementação de telas em React com Tailwind, consumo de APIs REST e participação nas cerimônias ágeis.\n\nRequisitos: HTML, CSS, JavaScript e vontade de aprender React. Desejável Git e noções de acessibilidade.' },

  { id: 'v6', titulo: 'Estagiário de Suporte Técnico N1', empresa: 'Metalúrgica Andrade', link: 'https://www.ciadeestagios.com.br/vaga/suporte-n1', salario: 'R$ 1.400,00', dias: 5, dataColeta: '31/08/2026, 06:00 (UTC)', modalidade: 'Presencial', area: 'Suporte', semestreMin: 1, pct: 45,
    razao: 'Escala 6x1 em horário comercial, incompatível com curso noturno',
    criterios: [
      { texto: 'Não exige tecnologia fora da sua grade', positivo: true },
      { texto: 'Escala 6x1 em horário comercial, incompatível com curso noturno', positivo: false },
      { texto: 'Atividade de suporte N1 não avança nas competências do 7º semestre', positivo: false }
    ],
    descricao: 'Atendimento de chamados N1: formatação de estações, troca de periféricos, apoio ao usuário de fábrica e registro em planilha de ocorrências. Escala 6x1, das 8h às 17h.' },

  { id: 'v7', titulo: 'Estágio em Engenharia de Dados (Pipelines)', empresa: 'Cobalto Analytics', link: 'https://www.ciadeestagios.com.br/vaga/eng-dados', salario: 'R$ 2.400,00', dias: 3, dataColeta: '02/09/2026, 06:00 (UTC)', modalidade: 'Híbrido', area: 'Dados', semestreMin: 8, pct: 57,
    razao: 'Pede Spark e Airflow, fora da grade do seu curso',
    criterios: [
      { texto: 'Pede Python e SQL, ambos na sua grade', positivo: true },
      { texto: 'Pede Apache Spark e Airflow, ausentes da grade do curso', positivo: false },
      { texto: 'Pede experiência anterior com pipelines em produção', positivo: false }
    ],
    descricao: 'Apoio ao time de dados na construção e monitoramento de pipelines em Airflow, transformações em Spark e modelagem de tabelas analíticas em data warehouse.' },

  { id: 'v8', titulo: 'Estagiário de Desenvolvimento .NET', empresa: 'Sigma Automação Industrial', link: 'https://www.ciadeestagios.com.br/vaga/dev-dotnet', salario: 'R$ 1.950,00', dias: 4, dataColeta: '01/09/2026, 06:00 (UTC)', modalidade: 'Presencial', area: 'Desenvolvimento', semestreMin: 5, pct: 71,
    razao: 'Pede orientação a objetos (na sua grade), mas em C#, que o curso não cobre',
    criterios: [
      { texto: 'Pede programação orientada a objetos, concluída no 3º semestre', positivo: true },
      { texto: 'Pede SQL Server — Banco de Dados II concluída no 5º semestre', positivo: true },
      { texto: 'A linguagem é C#, que não aparece na grade do curso', positivo: false }
    ],
    descricao: 'Manutenção de sistema legado em .NET Framework e apoio à migração para .NET 8. Integração com equipamentos de automação industrial via OPC.' }
];

// Prancha 1 — cartões do portal acadêmico simulado. Só "PROJETO STARTME" (novo:true) é clicável de verdade.
const PORTAIS = [
  { nome: 'Portal do Aluno', desc: 'Notas, boletim, matrícula e financeiro.' },
  { nome: 'Novo Portal do Professor', desc: 'Diário de classe e lançamento de notas.' },
  { nome: 'Portal Antigo do Professor/Funcionário', desc: 'Acesso legado, em desativação gradual.' },
  { nome: 'Moodle (Graduação)', desc: 'Ambiente virtual de aprendizagem dos cursos de graduação.' },
  { nome: 'AVA Pós', desc: 'Ambiente virtual dos cursos de pós-graduação.' },
  { nome: 'Cursos Livres', desc: 'Extensão e cursos de curta duração.' },
  { nome: 'Portal Mobile', desc: 'Versão do portal para aplicativo.' },
  { nome: 'PROJETO STARTME', desc: 'Vagas de estágio e primeiro emprego em TI, filtradas para o seu curso e semestre.', novo: true }
];

const FERRAMENTAS = ['Certificador de Documentos', 'Validador Diploma Digital', 'Validador Histórico Escolar Digital', 'Consulta Pública de Diplomas'];

// Prancha 8 — seed de candidaturas. Não existe endpoint de candidaturas em
// nenhum backend (ver design-reference/github.md); esta lista é combinada em
// tempo de execução com as candidaturas novas criadas pelo usuário e
// persistida em localStorage (chave startme:candidaturas) — ver js/api.js.
const CANDIDATURAS_SEED = [
  { protocolo: 'SM-2026-0391', vagaId: 'v2', titulo: 'Estágio em Análise de Dados', empresa: 'Grupo Vertere', link: 'https://www.ciadeestagios.com.br/vaga/analise-dados', data: '28/08/2026', status: 'entrevista',
    etapas: [{ nome: 'Candidatura enviada', quando: '28/08/2026', feita: true }, { nome: 'Em análise pela empresa', quando: '30/08/2026', feita: true }, { nome: 'Entrevista agendada', quando: '09/09/2026 · 14h', feita: true }, { nome: 'Resultado final', quando: '—', feita: false }] },
  { protocolo: 'SM-2026-0355', vagaId: 'v4', titulo: 'Estagiário de QA — Testes Manuais', empresa: 'Órbita Software', link: 'https://www.ciadeestagios.com.br/vaga/qa-manual', data: '19/08/2026', status: 'analise',
    etapas: [{ nome: 'Candidatura enviada', quando: '19/08/2026', feita: true }, { nome: 'Em análise pela empresa', quando: '21/08/2026', feita: true }, { nome: 'Entrevista', quando: '—', feita: false }, { nome: 'Resultado final', quando: '—', feita: false }] },
  { protocolo: 'SM-2026-0298', vagaId: 'v5', titulo: 'Estágio em Desenvolvimento Front-end React', empresa: 'Pilar Digital', link: 'https://www.ciadeestagios.com.br/vaga/front-react', data: '02/08/2026', status: 'recusada',
    etapas: [{ nome: 'Candidatura enviada', quando: '02/08/2026', feita: true }, { nome: 'Em análise pela empresa', quando: '05/08/2026', feita: true }, { nome: 'Não selecionado', quando: '14/08/2026', feita: true }] },
  { protocolo: 'SM-2026-0201', vagaId: 'v1', titulo: 'Estagiário de Desenvolvimento Back-end Python', empresa: 'Nexus Sistemas', link: 'https://www.ciadeestagios.com.br/vaga/back-end-python', data: '10/07/2026', status: 'finalizada',
    etapas: [{ nome: 'Candidatura enviada', quando: '10/07/2026', feita: true }, { nome: 'Entrevista realizada', quando: '22/07/2026', feita: true }, { nome: 'Contratado', quando: '01/08/2026', feita: true }] }
];

// Prancha 9 — dados acadêmicos usados quando GET {STARTME_CADASTRO_URL}/alunos/1 falha
// (backend fora do ar é o cenário mais provável no ambiente de teste).
const CAMPOS_ACADEMICOS_MOCK = [
  { rotulo: 'Nome completo', valor: 'Vinicius Pereira' },
  { rotulo: 'Curso', valor: 'Engenharia de Computação' },
  { rotulo: 'Semestre', valor: '7º de 10' },
  { rotulo: 'Situação do vínculo', valor: 'Ativo' }
];
const SEMESTRE_ALUNO_MOCK = 7;

// Prancha 9 — valores padrão dos "dados de empregabilidade" (não existem colunas
// para eles no schema relacional; ficam só em localStorage, chave startme:perfil).
const PERFIL_PADRAO = {
  email: 'vinicius.pereira@aluno.fsa.br',
  telefone: '(11) 9 8123-4567',
  github: 'github.com/viniciuspiva8',
  linkedin: 'linkedin.com/in/viniciuspereira',
  disponibilidade: 'Manhã e tarde · 6h/dia'
};
const INTERESSES_PADRAO = ['Desenvolvimento', 'Dados'];

// Prancha 12/13 — currículo e certificados são 100% mock (sem backend nenhum).
const CURRICULO_SECOES = {
  formacao: [{ curso: 'Engenharia de Computação', instituicao: 'Centro Universitário Fundação Santo André', periodo: '2023 — previsão 2028 · 7º semestre' }],
  experiencias: [],
  habilidades: ['Python', 'SQL', 'HTML/CSS/JavaScript', 'Git'],
  idiomas: ['Inglês — intermediário'],
  links: { github: 'github.com/viniciuspiva8', linkedin: 'linkedin.com/in/viniciuspereira' }
};

const CERTIFICADOS_SEED = [
  { id: 'c1', nome: 'Python para Data Science — Coursera.pdf', habilidade: 'Python (Data Science)', incluido: true },
  { id: 'c2', nome: 'Fundamentos de SQL — Alura.pdf', habilidade: 'SQL', incluido: true }
];

// Prancha 5 — opções de filtro.
const FAIXAS = [
  { v: 'todas', label: 'Qualquer valor' },
  { v: 'ate1500', label: 'Até R$ 1.500' },
  { v: '1500a2000', label: 'R$ 1.500 a R$ 2.000' },
  { v: 'acima2000', label: 'Acima de R$ 2.000' },
  { v: 'sem', label: 'Não informado na origem' }
];
const MODALIDADES = ['Presencial', 'Híbrido', 'Remoto'];
const AREAS = ['Desenvolvimento', 'Dados', 'Infraestrutura', 'Suporte', 'QA'];
const JANELAS = [{ v: '1', label: 'Hoje' }, { v: '7', label: '7 dias' }, { v: '30', label: '30 dias' }];
const POR_PAGINA = 5;

// Prancha 3 — o que é e o que não é compartilhado pelo Portal Acadêmico.
const DADOS_SIM = [
  { nome: 'Vínculo acadêmico ativo (sim/não)', para: 'Para confirmar que você é aluno da instituição' },
  { nome: 'Nome completo', para: 'Para personalizar a experiência dentro do StartMe' },
  { nome: 'Curso', para: 'Para filtrar vagas da sua área de formação' },
  { nome: 'Semestre em andamento', para: 'Para calcular a compatibilidade da vaga com o seu momento no curso' }
];
const DADOS_NAO = ['Notas', 'Histórico escolar', 'Dados financeiros', 'Faltas', 'CPF completo', 'Documentos'];

// Prancha 2 — coluna institucional (texto citado do Manual da Marca da FSA).
const MISSAO_INSTITUCIONAL = 'Produzir, disseminar e aplicar o conhecimento tecnológico e acadêmico, para formação cidadã, por meio do ensino, da pesquisa e da extensão.';
const VALORES_INSTITUCIONAIS = ['Cidadania', 'Ética', 'Inovação', 'Transparência'];

// Credenciais fixas de demonstração (Prancha 2) — não há autenticação real de
// usuário final em nenhum dos dois backends (ver README.md, "Pendências conhecidas").
const CPF_DEMO = '123.456.789-00';
const SENHA_DEMO = 'demo2026';

// Navegação lateral — modo "demo/QA" para mostrar a jornada completa tela a tela.
const NAV_GRUPOS_DEF = [
  { rotulo: 'Entrada', itens: [['portal', '1', 'Portal'], ['login', '2', 'Login'], ['consent', '3', 'Consentimento']] },
  { rotulo: 'Aplicação', itens: [['home', '4', 'Início'], ['lista', '5', 'Vagas'], ['detalhe', '6', 'Detalhe + 7'], ['candidaturas', '8', 'Candidaturas'], ['perfil', '9', 'Perfil']] },
  { rotulo: 'Currículo', itens: [['curriculo', '12', 'Currículo'], ['certificados', '13', 'Certificados']] },
  { rotulo: 'Referência', itens: [['excecoes', '10', 'Exceções'], ['sistema', '11', 'Sistema']] }
];

const STATUS_FILTROS_DEF = [
  ['todos', 'Todas'], ['enviada', 'Enviada'], ['analise', 'Em análise'],
  ['entrevista', 'Entrevista'], ['recusada', 'Não selecionado'], ['finalizada', 'Finalizada']
];
