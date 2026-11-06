import { describe, expect, it } from 'vitest';
import { derivarArea, derivarModalidade, enriquecerVagaReal, salarioCurto, salarioMin } from './vagas.js';

describe('enriquecerVagaReal: requisitos do coletor', () => {
  const base = { id: 'serpapi_1', titulo: 'Estágio em Python', empresa: 'ACME', link: 'https://acme.test', data_coleta: '2026-11-06', descricao: 'SQL' };

  it('usa os requisitos extraídos e torna a vaga avaliável', () => {
    const v = enriquecerVagaReal({ ...base, requisitos: { obrigatorios: ['Python', 'SQL'], desejaveis: ['Docker'] } });
    expect(v.avaliavel).toBe(true);
    expect(v.requisitos).toEqual({ obrigatorios: ['Python', 'SQL'], desejaveis: ['Docker'], condicoes: [] });
  });

  it('sem obrigatório reconhecido, a vaga não é avaliável', () => {
    expect(enriquecerVagaReal({ ...base, requisitos: { obrigatorios: [], desejaveis: ['Docker'] } }).avaliavel).toBe(false);
  });

  it('formato antigo ou inválido vira listas vazias, sem quebrar', () => {
    for (const requisitos of [undefined, null, 'Python', [{ tipo: 'requisito', texto: 'Python', termo: 'Python' }]]) {
      const v = enriquecerVagaReal({ ...base, requisitos });
      expect(v.avaliavel).toBe(false);
      expect(v.requisitos).toEqual({ obrigatorios: [], desejaveis: [], condicoes: [] });
    }
    const sujo = enriquecerVagaReal({ ...base, requisitos: { obrigatorios: [1, null, '  ', ' Git '], desejaveis: 'Docker' } });
    expect(sujo.requisitos).toEqual({ obrigatorios: ['Git'], desejaveis: [], condicoes: [] });
  });
});

describe('derivarArea', () => {
  it('classifica pelo título da vaga', () => {
    expect(derivarArea('Analista de QA Júnior')).toBe('QA');
    expect(derivarArea('Analista de Dados')).toBe('Dados');
    expect(derivarArea('Analista de Infraestrutura')).toBe('Infraestrutura');
    expect(derivarArea('Atendimento de Helpdesk')).toBe('Suporte');
  });

  it('cai em Desenvolvimento quando nada casa', () => {
    expect(derivarArea('Estágio em Java')).toBe('Desenvolvimento');
  });
});

describe('derivarModalidade', () => {
  it('reconhece remoto, híbrido e presencial (padrão)', () => {
    expect(derivarModalidade('Vaga remota')).toBe('Remoto');
    expect(derivarModalidade('Modelo híbrido')).toBe('Híbrido');
    expect(derivarModalidade('Trabalho no escritório')).toBe('Presencial');
  });
});

describe('salário', () => {
  it('extrai o menor valor declarado', () => {
    expect(salarioMin({ salario: 'R$ 1.500 a 2.000' })).toBe(1500);
    expect(salarioMin({ salario: '' })).toBeNull();
  });

  it('formata em pt-BR e mantém texto livre', () => {
    expect(salarioCurto('1500-2000')).toBe('R$ 1.500 a 2.000');
    expect(salarioCurto('a combinar')).toBe('a combinar');
    expect(salarioCurto(null)).toBeNull();
  });
});
