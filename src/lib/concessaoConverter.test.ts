import { describe, it, expect } from 'vitest';
import {
  COMMISSION_RATE,
  commissionPreview,
  isMonthlyValueInvalid,
  canSubmitConversion,
} from './concessaoConverter';

describe('commissionPreview', () => {
  it('aplica 7% sobre valor positivo', () => {
    expect(commissionPreview(1000)).toBeCloseTo(70);
    expect(commissionPreview(1500)).toBeCloseTo(105);
    expect(COMMISSION_RATE).toBe(0.07);
  });

  it('valor zero ou negativo → 0 (sem preview)', () => {
    expect(commissionPreview(0)).toBe(0);
    expect(commissionPreview(-50)).toBe(0);
  });

  it('NaN/Infinity → 0 (não vaza preview inválido)', () => {
    expect(commissionPreview(NaN)).toBe(0);
    expect(commissionPreview(Infinity)).toBe(0);
  });
});

describe('isMonthlyValueInvalid', () => {
  it('campo vazio NÃO é inválido (estado inicial)', () => {
    expect(isMonthlyValueInvalid('')).toBe(false);
  });

  it('valor <= 0 digitado é inválido', () => {
    expect(isMonthlyValueInvalid('0')).toBe(true);
    expect(isMonthlyValueInvalid('-10')).toBe(true);
  });

  it('valor positivo é válido', () => {
    expect(isMonthlyValueInvalid('100')).toBe(false);
    expect(isMonthlyValueInvalid('0.01')).toBe(false);
  });
});

describe('canSubmitConversion', () => {
  it('exige valor > 0 E csUserId', () => {
    expect(canSubmitConversion('1000', 'cs-1')).toBe(true);
  });

  it('bloqueia sem CS', () => {
    expect(canSubmitConversion('1000', '')).toBe(false);
  });

  it('bloqueia com valor vazio ou <= 0', () => {
    expect(canSubmitConversion('', 'cs-1')).toBe(false);
    expect(canSubmitConversion('0', 'cs-1')).toBe(false);
    expect(canSubmitConversion('-5', 'cs-1')).toBe(false);
  });
});
