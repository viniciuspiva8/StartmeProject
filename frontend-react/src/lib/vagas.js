// Regras de domínio da busca de vagas.
//
// A triagem (vale a pena abrir esta vaga?) vem de lib/match.js, que compara
// o currículo do aluno com os requisitos da vaga.

import { ORDEM_ESTADO, triagem } from './match.js';

export { triagem };

export function derivarArea(texto) {
  const t = texto.toLowerCase();
  if (/\bqa\b|teste|qualidade/.test(t)) return 'QA';
  if (/dados|data|analytics|\bbi\b|business intelligence/.test(t)) return 'Dados';
  if (/infra|rede|servidor|devops|infraestrutura/.test(t)) return 'Infraestrutura';
  if (/suporte|helpdesk|atendimento/.test(t)) return 'Suporte';
  return 'Desenvolvimento';
}

export function derivarModalidade(texto) {
  const t = texto.toLowerCase();
  if (/remoto|home ?office/.test(t)) return 'Remoto';
  if (/híbrid|hibrid/.test(t)) return 'Híbrido';
  return 'Presencial';
}

export function diasDesde(dataIso) {
  if (!dataIso) return 0;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}

/** Converte um registro REAL do coletor (Firestore) no formato da interface. */
export function enriquecerVagaReal(v) {
  const base = `${v.titulo || ''} ${v.descricao || ''}`;
  return {
    id: v.id,
    titulo: v.titulo || 'Vaga sem título na origem',
    empresa: v.empresa || 'Empresa não informada',
    link: v.link || '',
    salario: v.salario || '',
    dataColeta: v.data_coleta || '',
    dias: diasDesde(v.data_coleta),
    descricao: v.descricao || '',
    modalidade: derivarModalidade(base),
    area: derivarArea(base),
    semestreMin: 1,
    pct: 0,
    avaliavel: false,
    razao: '',
    criterios: [],
  };
}

export function salarioMin(v) {
  const nums = (v.salario || '').replace(/\./g, '').match(/\d+/g);
  return nums ? parseInt(nums[0], 10) : null;
}

/** "R$ 1.800,00" → "R$ 1.800"; "1500-2000" → "R$ 1.500 a 2.000"; texto livre fica como veio. */
export function salarioCurto(salario) {
  if (!salario) return null;
  const nums = salario.replace(/\./g, '').match(/\d+/g);
  if (!nums) return salario;
  const fmt = (n) => Number(n).toLocaleString('pt-BR');
  if (nums.length >= 2 && /-|a/.test(salario) && !/,/.test(salario)) return `R$ ${fmt(nums[0])} a ${fmt(nums[1])}`;
  return `R$ ${fmt(nums[0])}`;
}

export function quando(d) {
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

/** Campos de apresentação e estado do usuário sobre uma vaga. */
export function enfeitar(v, { aplicadas, salvas, perfil }) {
  return {
    ...v,
    monograma: v.empresa.trim().charAt(0).toUpperCase(),
    quandoTxt: quando(v.dias),
    nova: v.dias === 0,
    salarioTxt: salarioCurto(v.salario),
    triagem: triagem(v, perfil),
    aplicada: aplicadas.includes(v.id),
    salva: salvas.includes(v.id),
  };
}

export function passaFiltro(v, f, perfil) {
  if (f.q) {
    const alvo = `${v.titulo} ${v.empresa} ${v.descricao}`.toLowerCase();
    if (!alvo.includes(f.q.toLowerCase())) return false;
  }
  if (f.compatOnly) {
    const t = triagem(v, perfil);
    if (t.estado === 'nao' || t.estado === 'sem-dados' || t.acimaDoSemestre) return false;
  }
  if (f.mods.length && !f.mods.includes(v.modalidade)) return false;
  if (f.areas.length && !f.areas.includes(v.area)) return false;
  if (f.marcadas?.includes('salvas') && !f.salvas.includes(v.id)) return false;
  if (f.marcadas?.includes('candidatei') && !f.aplicadas.includes(v.id)) return false;
  const janela = parseInt(f.janela, 10);
  if (janela === 1 && v.dias > 0) return false;
  if (janela === 7 && v.dias > 7) return false;
  if (f.faixa !== 'todas') {
    const min = salarioMin(v);
    if (f.faixa === 'sem') { if (min !== null) return false; }
    else if (min === null) return false;
    else if (f.faixa === 'ate1500' && min > 1500) return false;
    else if (f.faixa === '1500a2000' && (min < 1500 || min > 2000)) return false;
    else if (f.faixa === 'acima2000' && min <= 2000) return false;
  }
  return true;
}

export function ordenar(lista, ord, perfil) {
  const copia = lista.slice();
  if (ord === 'compat') {
    return copia.sort((a, b) => {
      const ta = triagem(a, perfil);
      const tb = triagem(b, perfil);
      const porEstado = ORDEM_ESTADO[ta.estado] - ORDEM_ESTADO[tb.estado];
      if (porEstado !== 0) return porEstado;
      const ra = ta.total ? ta.atendidos / ta.total : 0;
      const rb = tb.total ? tb.atendidos / tb.total : 0;
      return rb - ra || a.dias - b.dias;
    });
  }
  if (ord === 'recentes') return copia.sort((a, b) => a.dias - b.dias);
  if (ord === 'salario') return copia.sort((a, b) => (salarioMin(b) ?? -1) - (salarioMin(a) ?? -1));
  return copia;
}
