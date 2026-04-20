import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnCollapse } from './useColumnCollapse';

describe('useColumnCollapse', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('começa com nenhuma coluna colapsada', () => {
    const { result } = renderHook(() => useColumnCollapse('design'));
    expect(result.current.isCollapsed('col-1')).toBe(false);
  });

  it('alterna estado via toggle', () => {
    const { result } = renderHook(() => useColumnCollapse('design'));
    act(() => result.current.toggle('col-1'));
    expect(result.current.isCollapsed('col-1')).toBe(true);
    act(() => result.current.toggle('col-1'));
    expect(result.current.isCollapsed('col-1')).toBe(false);
  });

  it('persiste estado em localStorage sob boardKey', () => {
    const { result } = renderHook(() => useColumnCollapse('design'));
    act(() => result.current.toggle('col-1'));
    const raw = window.localStorage.getItem('kanban-collapsed:design');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ 'col-1': true });
  });

  it('hidrata estado de localStorage ao montar', () => {
    window.localStorage.setItem(
      'kanban-collapsed:crm',
      JSON.stringify({ 'col-a': true, 'col-b': false })
    );
    const { result } = renderHook(() => useColumnCollapse('crm'));
    expect(result.current.isCollapsed('col-a')).toBe(true);
    expect(result.current.isCollapsed('col-b')).toBe(false);
  });

  it('isola boards diferentes pela boardKey', () => {
    const { result: design } = renderHook(() => useColumnCollapse('design'));
    const { result: crm } = renderHook(() => useColumnCollapse('crm'));

    act(() => design.current.toggle('col-1'));

    expect(design.current.isCollapsed('col-1')).toBe(true);
    expect(crm.current.isCollapsed('col-1')).toBe(false);
  });

  it('não quebra se localStorage lança ao gravar', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { result } = renderHook(() => useColumnCollapse('design'));
    expect(() => act(() => result.current.toggle('col-1'))).not.toThrow();
    spy.mockRestore();
  });

  it('ignora localStorage corrompido sem quebrar', () => {
    window.localStorage.setItem('kanban-collapsed:broken', 'not-json');
    const { result } = renderHook(() => useColumnCollapse('broken'));
    expect(result.current.isCollapsed('col-1')).toBe(false);
  });
});
