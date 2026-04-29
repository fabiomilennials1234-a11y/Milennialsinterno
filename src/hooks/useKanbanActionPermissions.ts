import { useQuery } from '@tanstack/react-query';
import {
  EMPTY_KANBAN_ACTION_PERMISSIONS,
  fetchKanbanActionPermissions,
  type KanbanActionPermissions,
} from '@/lib/kanbanActionPermissions';

export function useKanbanActionPermissions(
  boardId: string | null | undefined,
  fallback: KanbanActionPermissions = EMPTY_KANBAN_ACTION_PERMISSIONS,
) {
  const query = useQuery({
    queryKey: ['kanban-action-permissions', boardId],
    queryFn: () => fetchKanbanActionPermissions(boardId as string),
    enabled: !!boardId,
    staleTime: 60_000,
  });

  return {
    ...query,
    permissions: query.data ?? fallback,
    isUsingFallback: !query.data,
  };
}
