export const CHAVE_CURRICULO = 'startme:curriculo';
export const CHAVE_SALVAS = 'startme:salvas';
export const CHAVE_APLICADAS = 'startme:aplicadas';

export const FILTROS_PADRAO = { q: '', faixa: 'todas', mods: [], areas: [], compatOnly: false, janela: '30', marcadas: [] };
export const POR_LOTE = 10;

/** Máscara de CPF: 000.000.000-00 */
export function mascaraCpf(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (d.length > 3) return d.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return d;
}

// --- Rotas ------------------------------------------------------------------
export const ROTAS = { portal: 'portal', autorizacao: 'consent', inicio: 'inicio', vagas: 'vagas', curriculo: 'curriculo' };
export const HASH_DA_VIEW = Object.fromEntries(Object.entries(ROTAS).map(([hash, view]) => [view, hash]));
// Endereço antigo: a aba "Candidaturas" virou "Meu currículo" em 07/10/2026.
ROTAS.candidaturas = 'curriculo';

export function lerHash() {
  const [, rota = 'portal', sel = null] = window.location.hash.replace(/^#/, '').split('/');
  return { view: ROTAS[rota] || 'portal', sel: rota === 'vagas' ? sel : null };
}
export function montarHash(view, sel) {
  return `#/${HASH_DA_VIEW[view] || 'portal'}${view === 'vagas' && sel ? `/${sel}` : ''}`;
}
