import { describe, expect, it } from 'vitest';
import { canOperateKanban, resolveKanbanPageSlug } from './kanbanOperationalAccess';

describe('resolveKanbanPageSlug', () => {
  it('maps known kanban slugs to page grants', () => {
    expect(resolveKanbanPageSlug('design')).toBe('design');
    expect(resolveKanbanPageSlug('editor-video')).toBe('editor-video');
    expect(resolveKanbanPageSlug('produtora-board')).toBe('produtora');
    expect(resolveKanbanPageSlug('kanban-crm')).toBe('gestor-crm');
  });

  it('returns null for unknown boards', () => {
    expect(resolveKanbanPageSlug('custom-board')).toBeNull();
  });
});

describe('canOperateKanban', () => {
  it('allows admins independently of role or grants', () => {
    expect(canOperateKanban({
      role: 'financeiro',
      isAdmin: true,
      pageSlug: null,
      pageGrants: [],
      legacyCan: () => false,
    })).toBe(true);
  });

  it('keeps legacy role permissions valid', () => {
    expect(canOperateKanban({
      role: 'design',
      isAdmin: false,
      pageSlug: 'design',
      pageGrants: [],
      legacyCan: role => role === 'design',
    })).toBe(true);
  });

  it('allows operations when the user has the page grant', () => {
    expect(canOperateKanban({
      role: 'financeiro',
      isAdmin: false,
      pageSlug: 'design',
      pageGrants: ['design'],
      legacyCan: () => false,
    })).toBe(true);
  });

  it('denies operations when neither legacy role nor grant match', () => {
    expect(canOperateKanban({
      role: 'financeiro',
      isAdmin: false,
      pageSlug: 'design',
      pageGrants: ['financeiro'],
      legacyCan: () => false,
    })).toBe(false);
  });
});
