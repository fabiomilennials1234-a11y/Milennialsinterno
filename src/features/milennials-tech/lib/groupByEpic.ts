import { computeEpicRollup, type EpicRollup } from './rollup';
import type { BacklogIssue } from '../components/backlogTypes';

// ---------------------------------------------------------------------------
// groupIssuesByEpic (#170) — fold the flat backlog into Epic sections for the
// grouped view. Mirrors buildSquadLanes: a pure read transform, deterministic,
// no rendering. Epic sections follow the `epics` order (the caller passes them
// already key-ordered); "Sem Epic" (epic null) is ALWAYS last. Issue order is
// preserved within a section (the backlog arrives rank-sorted).
//
// Rollup source: an epic section reuses the caller's rollup map (full-epic basis,
// from useEpicRollupMap) so progress reflects the WHOLE epic, not the filtered
// slice. The "Sem Epic" bucket has no epic id, so its rollup is derived from its
// own issues via computeEpicRollup — consistent and self-contained.
//
// An epic with no issues in the current view is omitted (the filtered backlog
// decides visibility). Epics referenced by an issue must exist in `epics`
// (useTechEpics loads every epic), so no issue is silently dropped.
// ---------------------------------------------------------------------------

/** Collapse-state key for the "Sem Epic" bucket (it has no epic id). */
export const NO_EPIC_KEY = '__no_epic__';

export interface GroupEpic {
  id: string;
  title: string;
  key: string | null;
}

export interface EpicSection {
  /** The epic this section groups, or null for the "Sem Epic" bucket. */
  epic: GroupEpic | null;
  issues: BacklogIssue[];
  rollup: EpicRollup;
}

/** The collapse-state key for a section: the epic id, or NO_EPIC_KEY. */
export function sectionKey(section: EpicSection): string {
  return section.epic?.id ?? NO_EPIC_KEY;
}

export function groupIssuesByEpic(
  issues: BacklogIssue[],
  epics: GroupEpic[],
  rollups: Map<string, EpicRollup>,
): EpicSection[] {
  const byEpic = new Map<string, BacklogIssue[]>();
  const noEpic: BacklogIssue[] = [];

  for (const issue of issues) {
    if (issue.epicId) {
      const arr = byEpic.get(issue.epicId);
      if (arr) arr.push(issue);
      else byEpic.set(issue.epicId, [issue]);
    } else {
      noEpic.push(issue);
    }
  }

  const sections: EpicSection[] = [];

  for (const epic of epics) {
    const epicIssues = byEpic.get(epic.id);
    if (!epicIssues || epicIssues.length === 0) continue;
    sections.push({
      epic,
      issues: epicIssues,
      rollup: rollups.get(epic.id) ?? computeEpicRollup([]),
    });
  }

  if (noEpic.length > 0) {
    sections.push({
      epic: null,
      issues: noEpic,
      rollup: computeEpicRollup(
        noEpic.map((i) => ({ parent_id: null, story_points: i.storyPoints, status: i.status })),
      ),
    });
  }

  return sections;
}
