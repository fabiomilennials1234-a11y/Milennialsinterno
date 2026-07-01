import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isCardOverdue, terminalStatusesFromConfig } from './kanbanOverdue';
import { PRODUTORA_STATUSES } from '@/hooks/useProdutoraKanban';

// Pin "now" to a fixed local date so isPast/isToday are deterministic.
const NOW = new Date('2026-06-01T12:00:00');

describe('isCardOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when there is no due_date', () => {
    expect(isCardOverdue({ due_date: null, status: 'fazendo' }, [])).toBe(false);
  });

  it('returns true for a past deadline on a non-terminal status', () => {
    expect(isCardOverdue({ due_date: '2026-05-20', status: 'fazendo' }, ['aprovado'])).toBe(true);
  });

  it('returns false for a future deadline', () => {
    expect(isCardOverdue({ due_date: '2026-06-30', status: 'fazendo' }, ['aprovado'])).toBe(false);
  });

  it('returns false when the deadline is today', () => {
    expect(isCardOverdue({ due_date: '2026-06-01', status: 'fazendo' }, ['aprovado'])).toBe(false);
  });

  // PEDIDO 1 — the bug. Past deadline but status is terminal => NOT overdue.
  it('returns false for a past deadline when status is a Design terminal status (para_aprovacao)', () => {
    expect(
      isCardOverdue({ due_date: '2026-05-20', status: 'para_aprovacao' }, ['para_aprovacao', 'aprovado']),
    ).toBe(false);
  });

  it('returns false for a past deadline when status is aprovado (Design)', () => {
    expect(
      isCardOverdue({ due_date: '2026-05-20', status: 'aprovado' }, ['para_aprovacao', 'aprovado']),
    ).toBe(false);
  });

  it('returns false for a past deadline when status is aguardando_aprovacao (Video/Devs)', () => {
    expect(
      isCardOverdue({ due_date: '2026-05-20', status: 'aguardando_aprovacao' }, ['aguardando_aprovacao', 'aprovados']),
    ).toBe(false);
  });

  it('returns false for a past deadline when status is aprovados (Video/Devs)', () => {
    expect(
      isCardOverdue({ due_date: '2026-05-20', status: 'aprovados' }, ['aguardando_aprovacao', 'aprovados']),
    ).toBe(false);
  });

  // Produtora bug — card GRAVADO (terminal) vencido não conta como atrasado.
  it('returns false for a past deadline when status is gravado (Produtora terminal)', () => {
    expect(
      isCardOverdue({ due_date: '2026-05-20', status: 'gravado' }, ['gravado']),
    ).toBe(false);
  });

  it('still overdue for a past deadline on pos_producao (Produtora non-terminal)', () => {
    expect(
      isCardOverdue({ due_date: '2026-05-20', status: 'pos_producao' }, ['gravado']),
    ).toBe(true);
  });

  it('still overdue when status is in-progress even if other boards mark that word terminal', () => {
    // 'fazendo' is never terminal — past deadline => overdue.
    expect(
      isCardOverdue({ due_date: '2026-05-20', status: 'fazendo' }, ['para_aprovacao', 'aprovado']),
    ).toBe(true);
  });

  it('treats empty terminalStatuses as the legacy behaviour (status ignored)', () => {
    expect(isCardOverdue({ due_date: '2026-05-20', status: 'aprovado' }, [])).toBe(true);
  });
});

describe('terminalStatusesFromConfig', () => {
  it('extracts only statuses marked terminal', () => {
    const statuses = [
      { id: 'a_fazer' },
      { id: 'fazendo' },
      { id: 'para_aprovacao', terminal: true },
      { id: 'aprovado', terminal: true },
    ];
    expect(terminalStatusesFromConfig(statuses)).toEqual(['para_aprovacao', 'aprovado']);
  });

  it('returns empty array when nothing is terminal', () => {
    expect(terminalStatusesFromConfig([{ id: 'a_fazer' }, { id: 'fazendo' }])).toEqual([]);
  });

  it('extracts gravado (and only gravado) from the Produtora board config', () => {
    expect(terminalStatusesFromConfig(PRODUTORA_STATUSES)).toEqual(['gravado']);
  });
});
