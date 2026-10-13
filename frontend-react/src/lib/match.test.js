import { describe, expect, it } from 'vitest';
import { montarPerfil, normalizar, triagem, lacunas, vagasQueMudaram } from './match.js';
import { CURRICULO_SEED } from '../data/curriculo-seed.js';
import { VAGAS } from '../data/mock.js';

describe('normalizar', () => {
  it('remove acentos, caixa e espaços extras', () => {
    expect(normalizar('  Estágio   Ágil ')).toBe('estagio agil');
  });
});

describe('triagem e perfil', () => {
  const perfil = montarPerfil(CURRICULO_SEED, 7);
  const ESTADOS = ['vale', 'ressalvas', 'nao', 'sem-dados'];

  it('todo veredito é um dos estados conhecidos', () => {
    for (const v of VAGAS) expect(ESTADOS).toContain(triagem(v, perfil).estado);
  });

  it('vaga sem requisitos cadastrados cai em sem-dados', () => {
    expect(triagem({ id: 'x', titulo: 'Vaga sem dados', requisitos: null }, perfil).estado).toBe('sem-dados');
  });

  it('lacunas retorna no máximo o limite pedido, sem repetir termos', () => {
    const lista = lacunas(VAGAS, perfil, 3);
    expect(lista.length).toBeLessThanOrEqual(3);
    const termos = lista.map((x) => normalizar(x.termo));
    expect(new Set(termos).size).toBe(termos.length);
  });

  it('vagasQueMudaram conta mudança de veredito entre dois perfis', () => {
    const vazio = montarPerfil({ ...CURRICULO_SEED, certificacoes: [], atividades: [], habilidadesDeclaradas: [] }, 1);
    expect(vagasQueMudaram(VAGAS, vazio, perfil)).toBeGreaterThanOrEqual(0);
    expect(vagasQueMudaram(VAGAS, perfil, perfil)).toBe(0);
  });
});
