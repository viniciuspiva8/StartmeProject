import { describe, expect, it } from 'vitest';
import { digitos, mascarar, mascaraDigitacao, valido } from './cpf.js';

describe('cpf (front)', () => {
  it('aceita só CPF com dígitos verificadores corretos', () => {
    expect(valido('111.444.777-35')).toBe(true);
    expect(valido('111.444.777-36')).toBe(false);
    expect(valido('111.111.111-11')).toBe(false);
    expect(valido('123')).toBe(false);
  });

  it('mascara a digitação progressivamente', () => {
    expect(mascaraDigitacao('11144477735')).toBe('111.444.777-35');
    expect(mascaraDigitacao('1114')).toBe('111.4');
    expect(mascaraDigitacao('abc')).toBe('');
  });

  it('nunca devolve o CPF inteiro para exibição', () => {
    expect(mascarar('123.456.789-09')).toBe('***.456.789-**');
    expect(mascarar('12')).toBe('***.***.***-**');
    expect(digitos('123.456')).toBe('123456');
  });
});
