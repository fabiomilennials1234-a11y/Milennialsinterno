import { describe, it, expect } from 'vitest';
import { crmBoardMode } from './boardMode';

// Slice 3 (#138) — modo do board CRM por papel. PRD #135, ADR 0006.
// Módulo puro: papel -> 'manage' | 'readonly'. gestor_ads acompanha read-only;
// quem gere o board (gestor_crm + executivos) tem 'manage'. A defesa real é a
// RPC (autorização) e a RLS (#136/#137); este modo é a camada de UX.
describe('crmBoardMode', () => {
  it('gestor_ads -> readonly (acompanha, não opera)', () => {
    expect(crmBoardMode('gestor_ads')).toBe('readonly');
  });

  it('gestor_crm -> manage (dono do board, opera tudo)', () => {
    expect(crmBoardMode('gestor_crm')).toBe('manage');
  });

  it('gestor_projetos -> manage (executivo)', () => {
    expect(crmBoardMode('gestor_projetos')).toBe('manage');
  });

  it('ceo -> manage (executivo)', () => {
    expect(crmBoardMode('ceo')).toBe('manage');
  });

  it('cto -> manage (executivo)', () => {
    expect(crmBoardMode('cto')).toBe('manage');
  });

  // Default seguro (menor privilégio de UX): papel não-gestor do board cai em
  // readonly. A fronteira real continua sendo RPC/RLS; isto evita expor botões
  // de operação a um papel que por engano alcance o board.
  it('papel fora do conjunto de gestão -> readonly (default seguro)', () => {
    expect(crmBoardMode('financeiro')).toBe('readonly');
  });
});
