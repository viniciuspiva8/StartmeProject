import { describe, expect, it } from 'vitest';
import { derivarArea, derivarModalidade, salarioCurto, salarioMin } from './vagas.js';

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
