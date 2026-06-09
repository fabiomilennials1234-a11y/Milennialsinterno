import { describe, it, expect } from 'vitest';
import {
  FUNIL_A,
  FUNIL_B,
  FUNIL_ETAPAS,
  FUNIL_VALUES,
  isFunil,
  etapasDoFunil,
} from './funil';

// ADR 0010 — as etapas são contrato (constantes em código). Estes testes travam
// a forma exata: contagem, primeira/última etapa e os marcadores que diferenciam
// A de B. Mudar uma etapa exige mudar o teste conscientemente (não é acidente).

describe('FUNIL_A (14 etapas)', () => {
  it('tem exatamente 14 etapas', () => {
    expect(FUNIL_A).toHaveLength(14);
  });
  it('começa em Novo Lead e termina em Perdido', () => {
    expect(FUNIL_A[0]).toBe('Novo Lead');
    expect(FUNIL_A[FUNIL_A.length - 1]).toBe('Perdido');
  });
  it('tem o ramo de Automação / Qualificando / Qualificado Quente (marca do A)', () => {
    expect(FUNIL_A).toContain('Automação');
    expect(FUNIL_A).toContain('Qualificando');
    expect(FUNIL_A).toContain('Qualificado Quente');
  });
  it('NÃO tem etapas exclusivas de B', () => {
    expect(FUNIL_A).not.toContain('Cadência');
    expect(FUNIL_A).not.toContain('Coletando Informações');
    expect(FUNIL_A).not.toContain('Criando Proposta');
  });
});

describe('FUNIL_B (15 etapas)', () => {
  it('tem exatamente 15 etapas', () => {
    expect(FUNIL_B).toHaveLength(15);
  });
  it('começa em Novo Lead e termina em Agendado', () => {
    expect(FUNIL_B[0]).toBe('Novo Lead');
    expect(FUNIL_B[FUNIL_B.length - 1]).toBe('Agendado');
  });
  it('tem o ramo de Cadência / Coletando Informações / Criando Proposta (marca do B)', () => {
    expect(FUNIL_B).toContain('Cadência');
    expect(FUNIL_B).toContain('Coletando Informações');
    expect(FUNIL_B).toContain('Criando Proposta');
  });
});

describe('FUNIL_ETAPAS / FUNIL_VALUES', () => {
  it('FUNIL_VALUES é exatamente [A, B]', () => {
    expect(FUNIL_VALUES).toEqual(['A', 'B']);
  });
  it('mapeia A->FUNIL_A e B->FUNIL_B', () => {
    expect(FUNIL_ETAPAS.A).toBe(FUNIL_A);
    expect(FUNIL_ETAPAS.B).toBe(FUNIL_B);
  });
});

describe('isFunil', () => {
  it('aceita A e B', () => {
    expect(isFunil('A')).toBe(true);
    expect(isFunil('B')).toBe(true);
  });
  it('rejeita null, undefined, vazio e valores legados', () => {
    expect(isFunil(null)).toBe(false);
    expect(isFunil(undefined)).toBe(false);
    expect(isFunil('')).toBe(false);
    expect(isFunil('padrao')).toBe(false);
    expect(isFunil('personalizado')).toBe(false);
    expect(isFunil('C')).toBe(false);
  });
});

describe('etapasDoFunil', () => {
  it('devolve as etapas do preset válido', () => {
    expect(etapasDoFunil('A')).toBe(FUNIL_A);
    expect(etapasDoFunil('B')).toBe(FUNIL_B);
  });
  it('devolve [] (não quebra) para entrada nula/inválida/legada', () => {
    expect(etapasDoFunil(null)).toEqual([]);
    expect(etapasDoFunil(undefined)).toEqual([]);
    expect(etapasDoFunil('padrao')).toEqual([]);
  });
});
