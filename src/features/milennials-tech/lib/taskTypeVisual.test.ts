import { describe, it, expect } from 'vitest';
import { Constants } from '@/integrations/supabase/types';
import { ISSUE_TYPE_CONFIG } from './issueSystem';
import {
  TECH_TASK_TYPES,
  getTaskTypeVisual,
  DEFAULT_TASK_TYPE_VISUAL,
} from './taskTypeVisual';
import { TYPE_LABEL, getFriendlyTypeLabel } from './statusLabels';

describe('taskTypeVisual', () => {
  // The original PROD outage: a STORY task hit a 4-key lookup that returned
  // undefined and white-screened the kanban. These guard against any
  // tech_task_type value resolving an undefined visual ever again.

  it('canonical list mirrors the DB enum exactly', () => {
    // Cross-check against generated Supabase enum constant. When the DB enum
    // grows and types.ts is regenerated, this fails until TECH_TASK_TYPES is
    // updated — forcing the visual/label maps to be completed too.
    expect([...TECH_TASK_TYPES]).toEqual([...Constants.public.Enums.tech_task_type]);
  });

  it.each(TECH_TASK_TYPES)('resolves a defined visual for %s', (type) => {
    const visual = getTaskTypeVisual(type);
    expect(visual.icon).toBeTruthy();
    expect(typeof visual.icon).toBe('object'); // lucide forwardRef component
    expect(visual.color).toBeTruthy();
    expect(visual.bg).toBeTruthy();
  });

  it.each(TECH_TASK_TYPES)('resolves a defined label for %s', (type) => {
    expect(TYPE_LABEL[type]).toBeTruthy();
    expect(getFriendlyTypeLabel(type).label).toBeTruthy();
  });

  it('STORY and TASK reuse the canonical issue-system marks', () => {
    expect(getTaskTypeVisual('STORY').icon).toBe(ISSUE_TYPE_CONFIG.STORY.icon);
    expect(getTaskTypeVisual('TASK').icon).toBe(ISSUE_TYPE_CONFIG.TASK.icon);
    expect(getTaskTypeVisual('STORY').color).toBe(ISSUE_TYPE_CONFIG.STORY.color);
    expect(getTaskTypeVisual('TASK').color).toBe(ISSUE_TYPE_CONFIG.TASK.color);
  });

  it('falls back to a neutral visual for unknown / null values', () => {
    expect(getTaskTypeVisual('FUTURE_ENUM_VALUE')).toBe(DEFAULT_TASK_TYPE_VISUAL);
    expect(getTaskTypeVisual(null)).toBe(DEFAULT_TASK_TYPE_VISUAL);
    expect(getTaskTypeVisual(undefined)).toBe(DEFAULT_TASK_TYPE_VISUAL);
    expect(DEFAULT_TASK_TYPE_VISUAL.icon).toBeTruthy();
  });

  it('falls back to a neutral friendly label for unknown values', () => {
    // @ts-expect-error — exercising the runtime guard with an off-enum value
    expect(getFriendlyTypeLabel('FUTURE_ENUM_VALUE').label).toBeTruthy();
  });
});
