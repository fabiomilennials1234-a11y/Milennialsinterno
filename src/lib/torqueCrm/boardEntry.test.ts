import { describe, it, expect } from 'vitest';
import { boardEntryLabel } from './boardEntry';

// =============================================================================
// #128 — "No board desde DD/MM". Formata o created_at de um card do board CRM
// numa linha humana, no fuso America/Sao_Paulo (a verdade do dia-calendário é
// sempre SP — o card "entrou no board" no dia de SP, não no dia UTC).
// =============================================================================
describe('boardEntryLabel', () => {
  it('formata um created_at em "No board desde DD/MM" (fuso SP)', () => {
    // 2026-06-03T18:00:00Z = 15:00 em SP, ainda dia 03/06.
    expect(boardEntryLabel('2026-06-03T18:00:00Z')).toBe('No board desde 03/06');
  });

  it('usa o dia-calendário de SP, não o de UTC, na virada do dia', () => {
    // 2026-06-04T01:00:00Z = 22:00 SP do dia 03 (UTC-3). O card entrou no board
    // no dia 03 em SP, mesmo já sendo dia 04 em UTC.
    expect(boardEntryLabel('2026-06-04T01:00:00Z')).toBe('No board desde 03/06');
  });

  it('zero-padda dia e mês (DD/MM com dois dígitos)', () => {
    // 2026-01-05T12:00:00Z = 09:00 SP, dia 05/01.
    expect(boardEntryLabel('2026-01-05T12:00:00Z')).toBe('No board desde 05/01');
  });

  it('retorna null para entrada ausente (não renderiza a linha)', () => {
    expect(boardEntryLabel(null)).toBeNull();
    expect(boardEntryLabel(undefined)).toBeNull();
    expect(boardEntryLabel('')).toBeNull();
  });

  it('retorna null para string de data inválida', () => {
    expect(boardEntryLabel('não-é-data')).toBeNull();
  });
});
