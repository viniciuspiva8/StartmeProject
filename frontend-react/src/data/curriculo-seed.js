// Currículo inicial do aluno de demonstração. Nome, curso e semestre não ficam
// aqui: vêm do Portal Acadêmico (ou do cadastro) e não são editáveis.
export const CURRICULO_SEED = {
  contato: {
    email: 'vinicius.pereira@aluno.fsa.br',
    telefone: '(11) 98123-4567',
    cidade: 'Santo André, SP',
    linkedin: 'linkedin.com/in/viniciuspereira',
    github: 'github.com/viniciuspiva8',
  },
  resumo: '',
  certificacoes: [
    { id: 'c1', nome: 'Python para Data Science', instituicao: 'Coursera', ano: '2025', habilidades: ['Python', 'Pandas'], arquivo: '' },
    { id: 'c2', nome: 'Fundamentos de SQL', instituicao: 'Alura', ano: '2025', habilidades: ['SQL'], arquivo: '' },
  ],
  atividades: [
    { id: 'a1', tipo: 'Projeto acadêmico', titulo: 'StartMe, plataforma de empregabilidade (TCC)', organizacao: 'Fundação Santo André', periodo: '2026', descricao: 'Coletor de vagas em Python com FastAPI e Firestore, e interface em React.', habilidades: ['Python', 'React', 'APIs REST'] },
  ],
  idiomas: [{ id: 'i1', idioma: 'Inglês', nivel: 'Intermediário' }],
  habilidadesDeclaradas: [],
};

export const TIPOS_ATIVIDADE = ['Projeto acadêmico', 'Iniciação científica', 'Monitoria', 'Voluntariado', 'Empresa júnior', 'Evento ou hackathon'];
export const NIVEIS_IDIOMA = ['Básico', 'Intermediário', 'Avançado', 'Fluente'];
