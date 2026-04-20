import { useCallback, useEffect, useState } from 'react';

// Persiste estado de colapso por board no localStorage.
export function useColumnCollapse(boardKey: string) {
  const storageKey = `kanban-collapsed:${boardKey}`;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(collapsed));
    } catch {
      /* storage quota or private mode — silently ignore */
    }
  }, [collapsed, storageKey]);

  const toggle = useCallback((columnId: string) => {
    setCollapsed(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  }, []);

  const isCollapsed = useCallback(
    (columnId: string) => Boolean(collapsed[columnId]),
    [collapsed]
  );

  return { isCollapsed, toggle };
}
