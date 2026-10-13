import { CURRICULO_SEED } from '../data/curriculo-seed.js';
import { CAMPOS_ACADEMICOS_MOCK, SEMESTRE_ALUNO_MOCK, VAGAS } from '../data/mock.js';
import { lerLocal } from '../lib/api.js';
import { flushSync } from 'react-dom';
import { CHAVE_CURRICULO, CHAVE_SALVAS, CHAVE_APLICADAS, FILTROS_PADRAO, POR_LOTE, lerHash } from './constantes.js';

/** Executa a atualização dentro de uma View Transition quando o navegador oferece. */
export function comTransicao(atualizar) {
  if (typeof document !== 'undefined' && document.startViewTransition
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(() => flushSync(atualizar));
  } else {
    atualizar();
  }
}

export function novoId(prefixo) {
  return `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Currículos salvos antes de 08/10 guardavam habilidades como texto solto. */
export function normalizarHabilidades(lista) {
  return (lista || []).map((h) => (typeof h === 'string'
    ? { id: novoId('h'), nome: h, nivel: '', onde: '', ano: '', arquivo: '' }
    : h));
}

export function carregarCurriculo() {
  const cv = { ...CURRICULO_SEED, ...lerLocal(CHAVE_CURRICULO, {}) };
  return { ...cv, habilidadesDeclaradas: normalizarHabilidades(cv.habilidadesDeclaradas) };
}

export function estadoInicial() {
  const rota = lerHash();
  return {
    view: rota.view,
    sel: rota.sel,
    menuAberto: false,
    notasAbertas: false,
    servidor: null,      // resposta de /api/publico/config; null = sem servidor (modo local)
    sessao: null,        // resposta de /api/me quando o aluno tem sessão no servidor
    entrando: false,
    erroCodigo: null,
    toast: null,

    cpf: '',
    senha: '',
    verSenha: false,
    erroLogin: false,

    ...FILTROS_PADRAO,
    ord: 'compat',
    visiveis: POR_LOTE,

    salvas: lerLocal(CHAVE_SALVAS, ['v4']),
    aplicadas: lerLocal(CHAVE_APLICADAS, []),
    curriculo: carregarCurriculo(),
    habilidadeEmEdicao: null,

    vagas: VAGAS.map((v) => ({ ...v })),
    vagasFonte: 'mock',
    vagasCarregando: true,
    campos: CAMPOS_ACADEMICOS_MOCK,
    academicoFonte: 'mock',
    semestreAluno: SEMESTRE_ALUNO_MOCK,
  };
}
