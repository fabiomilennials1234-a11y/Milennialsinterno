import { describe, expect, it } from 'vitest';
import { buildEffectivePageGrantSets } from './pageGrantSync';

describe('buildEffectivePageGrantSets', () => {
  it('separates role defaults from direct extras', () => {
    const grants = buildEffectivePageGrantSets({
      role: 'financeiro',
      additionalPages: ['upsells', 'cliente-list'],
      canAccessMtech: false,
    });

    expect(grants.roleDefaultPages).toEqual(['cliente-list', 'comissoes', 'financeiro']);
    expect(grants.directPages).toEqual(['cliente-list', 'upsells']);
  });

  it('adds mtech as a direct grant when enabled', () => {
    const grants = buildEffectivePageGrantSets({
      role: 'design',
      additionalPages: [],
      canAccessMtech: true,
    });

    expect(grants.roleDefaultPages).toEqual(['design']);
    expect(grants.directPages).toEqual(['mtech']);
  });

  it('deduplicates and sorts page slugs for stable reconciliation', () => {
    const grants = buildEffectivePageGrantSets({
      role: 'design',
      additionalPages: ['upsells', 'upsells', 'cliente-list'],
      canAccessMtech: true,
    });

    expect(grants.directPages).toEqual(['cliente-list', 'mtech', 'upsells']);
  });
});
