// REQUISITOS DE DEMONSTRAÇÃO das vagas mock (v1 a v8).
// É o formato que a extração do coletor precisa produzir a partir do texto do
// anúncio: requisitos obrigatórios, desejáveis e condições da vaga (horário,
// local, salário) que pesam na decisão mas não estão no currículo.
// Vagas reais ainda não têm requisitos extraídos: aparecem como "sem dados".
export const REQUISITOS = {
  v1: {
    obrigatorios: ['Python', 'SQL'],
    desejaveis: ['Git', 'Docker', 'Testes'],
    condicoes: [{ texto: 'Estágio de 6 horas por dia, compatível com curso noturno', ok: true }],
  },
  v2: {
    obrigatorios: ['SQL', 'Excel', 'Estatística'],
    desejaveis: ['Power BI'],
    condicoes: [{ texto: 'Presencial em São Bernardo do Campo, sem turno informado no anúncio', ok: false }],
  },
  v3: {
    obrigatorios: [],
    desejaveis: ['Redes'],
    condicoes: [
      { texto: 'Não exige experiência prévia', ok: true },
      { texto: 'Programa de aprendiz costuma priorizar quem está nos primeiros semestres', ok: false },
      { texto: 'Escala 5x2 em horário comercial integral, incompatível com curso noturno', ok: false },
    ],
  },
  v4: {
    obrigatorios: ['Lógica de programação', 'Testes', 'SQL', 'APIs REST'],
    desejaveis: ['Jira'],
    condicoes: [{ texto: 'Salário "A combinar": não dá para avaliar a bolsa antes de se candidatar', ok: false }],
  },
  v5: {
    obrigatorios: ['JavaScript', 'HTML', 'CSS'],
    desejaveis: ['React', 'Git', 'TypeScript'],
    condicoes: [],
  },
  v6: {
    obrigatorios: ['Hardware'],
    desejaveis: [],
    condicoes: [
      { texto: 'Escala 6x1 em horário comercial, incompatível com curso noturno', ok: false },
      { texto: 'Suporte N1 não avança nas competências esperadas para o 7º semestre', ok: false },
    ],
  },
  v7: {
    obrigatorios: ['Python', 'SQL', 'Apache Spark', 'Airflow'],
    desejaveis: ['Cloud'],
    condicoes: [],
  },
  v8: {
    obrigatorios: ['Orientação a objetos', 'C#', 'SQL'],
    desejaveis: ['.NET'],
    condicoes: [],
  },
};
