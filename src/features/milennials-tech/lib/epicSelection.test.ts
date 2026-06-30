import { describe, it, expect } from 'vitest';
import { epicsForProject } from './epicSelection';

const epics = [
  { id: 'e1', projectId: 'p1', title: 'Checkout', key: 'AGS-1' },
  { id: 'e2', projectId: 'p1', title: 'Onboarding', key: 'AGS-2' },
  { id: 'e3', projectId: 'p2', title: 'Billing', key: 'KDEV-1' },
];

describe('epicsForProject', () => {
  it('returns only the epics that belong to the given project', () => {
    expect(epicsForProject(epics, 'p1').map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(epicsForProject(epics, 'p2').map((e) => e.id)).toEqual(['e3']);
  });

  it('returns empty when no project is selected (epics are project-scoped)', () => {
    expect(epicsForProject(epics, null)).toEqual([]);
    expect(epicsForProject(epics, undefined)).toEqual([]);
    expect(epicsForProject(epics, '')).toEqual([]);
  });

  it('returns empty when the project has no epics', () => {
    expect(epicsForProject(epics, 'p-without-epics')).toEqual([]);
  });
});
