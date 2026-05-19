import { describe, it, expect } from 'vitest';
import { COLUMNS } from './GestorProjetosPage';

describe('GestorProjetosPage COLUMNS', () => {
  it('Tarefas Diárias é a segunda coluna', () => {
    expect(COLUMNS[1].id).toBe('tarefas-diarias');
    expect(COLUMNS[1].title).toBe('Tarefas Diárias');
  });

  it('Acompanhamento Gestores é a quarta coluna (adjacente a Tarefas)', () => {
    expect(COLUMNS[3].id).toBe('acompanhamento-growth');
    expect(COLUMNS[3].title).toBe('Acompanhamento Gestores');
  });

  it('Novos Clientes + Onboarding é a terceira coluna (unificada)', () => {
    expect(COLUMNS[2].id).toBe('novos-clientes-onboarding');
    expect(COLUMNS[2].title).toBe('Novos Clientes + Onboarding');
  });

  it('ordem completa das 11 colunas', () => {
    const ids = COLUMNS.map(c => c.id);
    expect(ids).toEqual([
      'oraculo',
      'tarefas-diarias',
      'novos-clientes-onboarding',
      'acompanhamento-growth',
      'metricas',
      'atrasados',
      'atrasos-justificativas',
      'reuniao-1a1',
      'ferramentas',
      'bonus',
      'lemas',
    ]);
  });

  it('total de 11 colunas', () => {
    expect(COLUMNS).toHaveLength(11);
  });
});
