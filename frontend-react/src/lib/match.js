// MOTOR DE MATCH: currículo do aluno × requisitos da vaga.
//
// 1. montarPerfil() junta tudo o que o aluno tem, de quatro fontes, guardando
//    de onde veio cada habilidade: a grade cursada até o semestre atual (vinda
//    do Portal Acadêmico), certificações, atividades e as habilidades que o
//    próprio aluno declarou.
// 2. triagem() compara o perfil com os requisitos da vaga. Contam para o
//    veredito os requisitos obrigatórios e as condições da vaga; os desejáveis
//    aparecem como diferencial, sem penalizar.
// Roda inteiro no navegador e é recalculado sempre que o currículo muda.
import { GRADE } from '../data/grade.js';
import { REQUISITOS } from '../data/requisitos.js';

/** "Orientação a Objetos" e "orientacao a objetos" viram a mesma chave. */
export function normalizar(termo) {
  return String(termo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Mapa habilidade → fontes. Cada fonte: { tipo, nome, detalhe? }. */
export function montarPerfil(curriculo, semestreAluno) {
  const habilidades = new Map();
  const add = (termo, fonte) => {
    const k = normalizar(termo);
    if (!k) return;
    if (!habilidades.has(k)) habilidades.set(k, { termo, fontes: [] });
    habilidades.get(k).fontes.push(fonte);
  };

  GRADE.filter((d) => d.semestre <= semestreAluno).forEach((d) => {
    d.habilidades.forEach((h) => add(h, { tipo: 'disciplina', nome: d.disciplina, detalhe: `${d.semestre}º semestre` }));
  });
  (curriculo.certificacoes || []).forEach((c) => {
    (c.habilidades || []).forEach((h) => add(h, { tipo: 'certificado', nome: c.nome, detalhe: c.instituicao }));
  });
  (curriculo.atividades || []).forEach((a) => {
    (a.habilidades || []).forEach((h) => add(h, { tipo: 'atividade', nome: a.titulo, detalhe: a.tipo }));
  });
  (curriculo.habilidadesDeclaradas || []).forEach((h) => {
    const item = typeof h === 'string' ? { nome: h } : h;
    add(item.nome, {
      tipo: 'declarada', nome: item.nome, nivel: item.nivel, onde: item.onde, ano: item.ano, comprovante: !!item.arquivo,
    });
  });

  return { semestreAluno, habilidades };
}

const ROTULO_FONTE = {
  disciplina: (f) => `pela disciplina ${f.nome} (${f.detalhe})`,
  certificado: (f) => `pelo certificado ${f.nome}${f.detalhe ? ` (${f.detalhe})` : ''}`,
  atividade: (f) => `em ${f.nome}`,
  declarada: (f) => {
    const partes = [];
    if (f.nivel) partes.push(`nível ${f.nivel.toLowerCase()}`);
    if (f.onde) partes.push(`aprendido em ${f.onde}${f.ano ? ` (${f.ano})` : ''}`);
    else if (f.ano) partes.push(`desde ${f.ano}`);
    if (f.comprovante) partes.push('com certificado');
    return partes.length ? partes.join(', ') : 'declarado por você';
  },
};
// Ordem de preferência para explicar a origem: comprovado vem antes de declarado.
const PESO_FONTE = { certificado: 0, atividade: 1, disciplina: 2, declarada: 3 };

/** Melhor fonte para explicar por que o aluno tem a habilidade, ou null. */
export function fonteDe(perfil, termo) {
  const h = perfil.habilidades.get(normalizar(termo));
  if (!h) return null;
  // Habilidade declarada com certificado anexado pesa como comprovada.
  const peso = (f) => (f.tipo === 'declarada' && f.comprovante ? 0 : PESO_FONTE[f.tipo]);
  return [...h.fontes].sort((a, b) => peso(a) - peso(b))[0];
}

const VEREDITOS = {
  vale: 'Vale o seu tempo',
  ressalvas: 'Vale, com ressalvas',
  nao: 'Provavelmente não',
  'sem-dados': 'Sem dados para avaliar',
};
export const ORDEM_ESTADO = { vale: 0, ressalvas: 1, nao: 2, 'sem-dados': 3 };

/** Avalia a vaga contra o perfil. Formato consumido por components/Triagem.jsx. */
export function triagem(v, perfil) {
  const req = v.avaliavel === false ? null : REQUISITOS[v.id];
  if (!req) {
    return {
      estado: 'sem-dados', veredito: VEREDITOS['sem-dados'], atendidos: 0, total: 0,
      criterios: [], desejaveis: [], ressalvas: [], principalRessalva: null, acimaDoSemestre: false, faltantes: [],
    };
  }

  const criterios = [
    ...req.obrigatorios.map((termo) => {
      const fonte = fonteDe(perfil, termo);
      return fonte
        ? { tipo: 'requisito', termo, positivo: true, texto: `Pede ${termo}: você tem, ${ROTULO_FONTE[fonte.tipo](fonte)}`, fonte }
        : { tipo: 'requisito', termo, positivo: false, texto: `Pede ${termo}: ainda não está no seu currículo` };
    }),
    ...req.condicoes.map((c) => ({ tipo: 'condicao', positivo: c.ok, texto: c.texto })),
  ];
  const desejaveis = req.desejaveis.map((termo) => {
    const fonte = fonteDe(perfil, termo);
    return { termo, positivo: !!fonte, fonte };
  });

  const acimaDoSemestre = v.semestreMin > perfil.semestreAluno;
  if (acimaDoSemestre) {
    criterios.push({ tipo: 'condicao', positivo: false, texto: `Pede a partir do ${v.semestreMin}º semestre; você está no ${perfil.semestreAluno}º` });
  }

  const atendidos = criterios.filter((c) => c.positivo).length;
  const total = criterios.length;
  const razao = total ? atendidos / total : 0;
  let estado = razao >= 0.75 ? 'vale' : razao >= 0.5 ? 'ressalvas' : 'nao';
  if (acimaDoSemestre && estado === 'vale') estado = 'ressalvas';

  const ressalvas = criterios.filter((c) => !c.positivo);
  return {
    estado, veredito: VEREDITOS[estado], atendidos, total, criterios, desejaveis, ressalvas,
    principalRessalva: ressalvas[0]?.texto ?? null,
    acimaDoSemestre,
    faltantes: criterios.filter((c) => c.tipo === 'requisito' && !c.positivo).map((c) => c.termo),
  };
}

/** Habilidades obrigatórias mais pedidas nas vagas que ainda faltam no currículo. */
export function lacunas(vagas, perfil, limite = 4) {
  const cont = new Map();
  vagas.forEach((v) => {
    triagem(v, perfil).faltantes.forEach((termo) => {
      const k = normalizar(termo);
      const atual = cont.get(k) || { termo, vagas: 0 };
      atual.vagas += 1;
      cont.set(k, atual);
    });
  });
  return [...cont.values()].sort((a, b) => b.vagas - a.vagas || a.termo.localeCompare(b.termo)).slice(0, limite);
}

/** Quantas vagas mudaram de veredito entre dois perfis (para o aviso após editar o currículo). */
export function vagasQueMudaram(vagas, antes, depois) {
  return vagas.filter((v) => triagem(v, antes).estado !== triagem(v, depois).estado).length;
}
