// Backlog reorder geometry (slice #156).
//
// Pure: picks the two NEIGHBORS that bracket a drop target. It deliberately does
// NOT compute the new lexorank — that arithmetic is the DB's single source of
// truth (public.tech_lexo_between). The client only says "between these two".

export interface RankedItem {
  id: string;
  rank: string;
}

export interface ReorderNeighbors {
  prevRank: string | null;
  nextRank: string | null;
}

/**
 * Given the current rank-ordered list, the id being moved and the destination
 * index *in the list after the moved item is removed*, returns the ranks of the
 * items immediately before/after that slot. `null` means "edge" (top or bottom).
 *
 * The DB then computes tech_lexo_between(prevRank, nextRank) for the new rank.
 */
export function computeReorderNeighbors(
  ordered: RankedItem[],
  movedId: string,
  targetIndex: number,
): ReorderNeighbors {
  const without = ordered.filter((item) => item.id !== movedId);
  const index = Math.max(0, Math.min(targetIndex, without.length));

  return {
    prevRank: index > 0 ? without[index - 1].rank : null,
    nextRank: index < without.length ? without[index].rank : null,
  };
}
