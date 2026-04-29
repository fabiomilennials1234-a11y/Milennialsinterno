import { describe, expect, it } from 'vitest';
import { normalizeKanbanActionPermissions } from './kanbanActionPermissions';

describe('normalizeKanbanActionPermissions', () => {
  it('defaults missing permissions to false', () => {
    expect(normalizeKanbanActionPermissions(null)).toEqual({
      canCreate: false,
      canMove: false,
      canArchive: false,
      canDelete: false,
      canEditBriefing: false,
    });
  });

  it('only accepts explicit true values', () => {
    expect(normalizeKanbanActionPermissions({
      canCreate: true,
      canMove: false,
      canArchive: true,
    })).toEqual({
      canCreate: true,
      canMove: false,
      canArchive: true,
      canDelete: false,
      canEditBriefing: false,
    });
  });
});
