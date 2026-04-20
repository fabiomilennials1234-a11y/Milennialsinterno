import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KanbanColumn, KanbanCard } from '@/hooks/useKanban';

interface UseKanbanKeyboardOptions {
  columns: KanbanColumn[];
  cardsByColumn: Record<string, KanbanCard[]>;
  onOpenCard?: (card: KanbanCard) => void;
  onCreateCard?: (columnId: string) => void;
  onFocusSearch?: () => void;
  onArchiveCard?: (card: KanbanCard) => void;
  onDeleteCard?: (card: KanbanCard) => void;
  onToggleFocusMode?: () => void;
  enabled?: boolean;
}

// Atalhos inspirados em Linear: / busca, c cria, ↑↓←→ navega, Enter/Space abre.
export function useKanbanKeyboard({
  columns,
  cardsByColumn,
  onOpenCard,
  onCreateCard,
  onFocusSearch,
  onArchiveCard,
  onDeleteCard,
  onToggleFocusMode,
  enabled = true,
}: UseKanbanKeyboardOptions) {
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const columnsRef = useRef(columns);
  const cardsRef = useRef(cardsByColumn);

  useEffect(() => {
    columnsRef.current = columns;
    cardsRef.current = cardsByColumn;
  }, [columns, cardsByColumn]);

  const flatLocation = useMemo(() => {
    const map = new Map<string, { columnIndex: number; cardIndex: number }>();
    columns.forEach((col, colIdx) => {
      (cardsByColumn[col.id] || []).forEach((card, cardIdx) => {
        map.set(card.id, { columnIndex: colIdx, cardIndex: cardIdx });
      });
    });
    return map;
  }, [columns, cardsByColumn]);

  const moveFocus = useCallback(
    (dx: number, dy: number) => {
      const cols = columnsRef.current;
      const bucket = cardsRef.current;
      if (cols.length === 0) return;

      const loc = focusedCardId ? flatLocation.get(focusedCardId) : undefined;
      const hasFocus = !!loc;
      let colIdx = loc?.columnIndex ?? focusedColumnIndex;
      let cardIdx = loc?.cardIndex ?? 0;

      if (dx !== 0) {
        colIdx = (colIdx + dx + cols.length) % cols.length;
        cardIdx = 0;
      } else if (dy !== 0) {
        const bucketCards = bucket[cols[colIdx].id] || [];
        if (bucketCards.length === 0) return;
        if (!hasFocus) {
          // Primeira navegação vertical foca o primeiro card da coluna ativa.
          cardIdx = 0;
        } else {
          cardIdx = (cardIdx + dy + bucketCards.length) % bucketCards.length;
        }
      }

      const targetCards = bucket[cols[colIdx].id] || [];
      setFocusedColumnIndex(colIdx);
      setFocusedCardId(targetCards[cardIdx]?.id ?? null);
    },
    [focusedCardId, focusedColumnIndex, flatLocation]
  );

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditable) return;

      if (e.key === '/') {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        const cols = columnsRef.current;
        const col = cols[focusedColumnIndex] || cols[0];
        if (col) {
          e.preventDefault();
          onCreateCard?.(col.id);
        }
        return;
      }

      if ((e.key === 'f' || e.key === 'F') && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleFocusMode?.();
        return;
      }

      // Shift+A arquiva, Shift+D deleta — atuam no card focado.
      if (e.shiftKey && (e.key === 'A' || e.key === 'a') && focusedCardId) {
        const loc = flatLocation.get(focusedCardId);
        if (!loc) return;
        const card = cardsRef.current[columnsRef.current[loc.columnIndex].id]?.[loc.cardIndex];
        if (card) {
          e.preventDefault();
          onArchiveCard?.(card);
        }
        return;
      }

      if (e.shiftKey && (e.key === 'D' || e.key === 'd') && focusedCardId) {
        const loc = flatLocation.get(focusedCardId);
        if (!loc) return;
        const card = cardsRef.current[columnsRef.current[loc.columnIndex].id]?.[loc.cardIndex];
        if (card) {
          e.preventDefault();
          onDeleteCard?.(card);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocus(0, -1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveFocus(0, 1);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveFocus(-1, 0);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveFocus(1, 0);
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && focusedCardId) {
        const loc = flatLocation.get(focusedCardId);
        if (!loc) return;
        const card = cardsRef.current[columnsRef.current[loc.columnIndex].id]?.[loc.cardIndex];
        if (card) {
          e.preventDefault();
          onOpenCard?.(card);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    enabled,
    focusedCardId,
    focusedColumnIndex,
    flatLocation,
    moveFocus,
    onCreateCard,
    onFocusSearch,
    onOpenCard,
    onArchiveCard,
    onDeleteCard,
    onToggleFocusMode,
  ]);

  return { focusedCardId, focusedColumnIndex, setFocusedCardId };
}
