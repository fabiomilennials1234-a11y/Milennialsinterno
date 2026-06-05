import { describe, it, expect } from 'vitest';
import { resolveSlaColumn, resolveSlaDays, type SlaMap } from './crmSla';

// =============================================================================
// #130 — Resolver de SLA: (board_status, produto) -> max_days.
//
// A coluna LÓGICA do board é board_status, EXCETO quando board_status='tier':
// aí a coluna é o próprio produto (torque/automation/copilot). pronto -> sem SLA.
// Espelha columnOf() de CrmBoardKanban, mas puro e testável.
//
// O SlaMap vem do DB (tabela crm_sla, #129): coluna -> max_days. Coluna ausente
// no mapa = sem SLA (null), idêntico a pronto.
// =============================================================================

const slaMap: SlaMap = {
  a_fazer: 2,
  torque: 3,
  automation: 5,
  copilot: 10,
  apresentacao: 4,
  // pronto ausente de propósito (sem SLA)
};

describe('resolveSlaColumn — coluna lógica', () => {
  it('board_status=tier resolve para o produto', () => {
    expect(resolveSlaColumn('tier', 'torque')).toBe('torque');
    expect(resolveSlaColumn('tier', 'automation')).toBe('automation');
    expect(resolveSlaColumn('tier', 'copilot')).toBe('copilot');
  });

  it('board_status não-tier resolve para o próprio board_status', () => {
    expect(resolveSlaColumn('a_fazer', 'torque')).toBe('a_fazer');
    expect(resolveSlaColumn('apresentacao', 'copilot')).toBe('apresentacao');
    expect(resolveSlaColumn('pronto', 'torque')).toBe('pronto');
  });
});

describe('resolveSlaDays — max_days da coluna lógica', () => {
  it('tier desdobra por produto e pega o SLA do produto', () => {
    expect(resolveSlaDays(slaMap, 'tier', 'torque')).toBe(3);
    expect(resolveSlaDays(slaMap, 'tier', 'copilot')).toBe(10);
  });

  it('colunas diretas pegam seu próprio SLA', () => {
    expect(resolveSlaDays(slaMap, 'a_fazer', 'torque')).toBe(2);
    expect(resolveSlaDays(slaMap, 'apresentacao', 'automation')).toBe(4);
  });

  it('pronto não tem SLA (null)', () => {
    expect(resolveSlaDays(slaMap, 'pronto', 'torque')).toBeNull();
  });

  it('coluna ausente do mapa = sem SLA (null), nunca undefined', () => {
    expect(resolveSlaDays({}, 'a_fazer', 'torque')).toBeNull();
  });
});
