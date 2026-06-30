// ---------------------------------------------------------------------------
// Epic↔issue linking (#169). An issue can only carry an Epic from its OWN
// project — epics are project-scoped (DB: tech_epics.project_id; the RPC rejects
// a cross-project epic_id). The picker therefore narrows the global epic list to
// the issue's current project. Pure so the rule is tested in isolation, never
// buried in the Select's JSX.
// ---------------------------------------------------------------------------

export function epicsForProject<T extends { projectId: string }>(
  epics: T[],
  projectId: string | null | undefined,
): T[] {
  if (!projectId) return [];
  return epics.filter((e) => e.projectId === projectId);
}
