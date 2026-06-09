import { describe, it, expect } from 'vitest';
import { classifyExpiry, countExpiringSoon } from './concessaoExpiry';

// Âncora fixa para determinismo (sem dependência do relógio real).
const NOW = new Date('2026-06-08T12:00:00Z');

function isoInDays(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

describe('classifyExpiry', () => {
  it('sem prazo (null/undefined) → none', () => {
    expect(classifyExpiry(null, NOW)).toBe('none');
    expect(classifyExpiry(undefined, NOW)).toBe('none');
  });

  it('data passada → overdue', () => {
    expect(classifyExpiry(isoInDays(-1), NOW)).toBe('overdue');
    expect(classifyExpiry(isoInDays(-30), NOW)).toBe('overdue');
  });

  it('hoje (dia 0) → due_soon (limite inferior da janela)', () => {
    expect(classifyExpiry(isoInDays(0), NOW)).toBe('due_soon');
  });

  it('dia 7 → due_soon (limite superior inclusivo)', () => {
    expect(classifyExpiry(isoInDays(7), NOW)).toBe('due_soon');
  });

  it('dia 8 → future (fora da janela de alerta)', () => {
    expect(classifyExpiry(isoInDays(8), NOW)).toBe('future');
  });
});

describe('countExpiringSoon', () => {
  it('conta só ATIVAS na janela due_soon', () => {
    const rows = [
      { status: 'ativa', contract_expires_at: isoInDays(3) }, // conta
      { status: 'ativa', contract_expires_at: isoInDays(7) }, // conta
      { status: 'ativa', contract_expires_at: isoInDays(8) }, // future, não conta
      { status: 'ativa', contract_expires_at: isoInDays(-1) }, // overdue, não conta
      { status: 'ativa', contract_expires_at: null }, // sem prazo, não conta
      { status: 'convertida', contract_expires_at: isoInDays(2) }, // não-ativa, não conta
      { status: 'revogada', contract_expires_at: isoInDays(1) }, // não-ativa, não conta
    ];
    expect(countExpiringSoon(rows, NOW)).toBe(2);
  });

  it('lista vazia → 0', () => {
    expect(countExpiringSoon([], NOW)).toBe(0);
  });
});
