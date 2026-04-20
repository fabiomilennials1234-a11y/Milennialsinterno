import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKanbanKeyboard } from './useKanbanKeyboard';
import type { KanbanColumn, KanbanCard } from './useKanban';

const makeCard = (id: string, columnId: string): KanbanCard => ({
  id,
  column_id: columnId,
  board_id: 'b1',
  title: id,
  description: null,
  priority: 'medium',
  status: null,
  due_date: null,
  position: 0,
  progress: 0,
  tags: null,
  justification: null,
  archived: false,
  archived_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: null,
} as unknown as KanbanCard);

const columns: KanbanColumn[] = [
  { id: 'c1', title: 'Col 1', position: 0, board_id: 'b1', color: 'info' } as unknown as KanbanColumn,
  { id: 'c2', title: 'Col 2', position: 1, board_id: 'b1', color: 'warning' } as unknown as KanbanColumn,
];

const cardsByColumn: Record<string, KanbanCard[]> = {
  c1: [makeCard('a1', 'c1'), makeCard('a2', 'c1')],
  c2: [makeCard('b1', 'c2')],
};

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const evt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  act(() => {
    window.dispatchEvent(evt);
  });
  return evt;
}

beforeEach(() => {
  // Garante que não há input com foco entre testes
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
});

describe('useKanbanKeyboard', () => {
  it('C chama onCreateCard da coluna focada', () => {
    const onCreateCard = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onCreateCard })
    );
    press('C');
    expect(onCreateCard).toHaveBeenCalledWith('c1');
  });

  it('/ chama onFocusSearch', () => {
    const onFocusSearch = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onFocusSearch })
    );
    press('/');
    expect(onFocusSearch).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown navega para próximo card dentro da coluna', () => {
    const { result } = renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn })
    );
    press('ArrowDown');
    expect(result.current.focusedCardId).toBe('a1');
    press('ArrowDown');
    expect(result.current.focusedCardId).toBe('a2');
  });

  it('ArrowRight muda de coluna e reseta para primeiro card', () => {
    const { result } = renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn })
    );
    press('ArrowDown');
    press('ArrowDown');
    expect(result.current.focusedCardId).toBe('a2');
    press('ArrowRight');
    expect(result.current.focusedCardId).toBe('b1');
  });

  it('Enter abre card em foco via onOpenCard', () => {
    const onOpenCard = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onOpenCard })
    );
    press('ArrowDown');
    press('Enter');
    expect(onOpenCard).toHaveBeenCalledTimes(1);
    expect(onOpenCard.mock.calls[0][0].id).toBe('a1');
  });

  it('ignora teclas quando foco está em input', () => {
    const onCreateCard = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onCreateCard })
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const evt = new KeyboardEvent('keydown', { key: 'C', bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'target', { value: input });
    act(() => {
      window.dispatchEvent(evt);
    });
    expect(onCreateCard).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('não escuta eventos quando enabled=false', () => {
    const onCreateCard = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onCreateCard, enabled: false })
    );
    press('C');
    expect(onCreateCard).not.toHaveBeenCalled();
  });

  it('ArrowLeft wraps da primeira coluna para a última', () => {
    const { result } = renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn })
    );
    press('ArrowDown');
    expect(result.current.focusedCardId).toBe('a1');
    press('ArrowLeft');
    expect(result.current.focusedCardId).toBe('b1');
  });

  it('Shift+A arquiva o card em foco', () => {
    const onArchiveCard = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onArchiveCard })
    );
    press('ArrowDown');
    press('A', { shiftKey: true });
    expect(onArchiveCard).toHaveBeenCalledTimes(1);
    expect(onArchiveCard.mock.calls[0][0].id).toBe('a1');
  });

  it('Shift+D deleta o card em foco', () => {
    const onDeleteCard = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onDeleteCard })
    );
    press('ArrowDown');
    press('D', { shiftKey: true });
    expect(onDeleteCard).toHaveBeenCalledTimes(1);
    expect(onDeleteCard.mock.calls[0][0].id).toBe('a1');
  });

  it('F dispara onToggleFocusMode', () => {
    const onToggleFocusMode = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onToggleFocusMode })
    );
    press('F');
    expect(onToggleFocusMode).toHaveBeenCalledTimes(1);
  });

  it('não arquiva sem card focado', () => {
    const onArchiveCard = vi.fn();
    renderHook(() =>
      useKanbanKeyboard({ columns, cardsByColumn, onArchiveCard })
    );
    press('A', { shiftKey: true });
    expect(onArchiveCard).not.toHaveBeenCalled();
  });
});
