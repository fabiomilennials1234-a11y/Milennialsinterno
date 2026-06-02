import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentPiP, isDocumentPiPSupported } from '../useDocumentPiP';

afterEach(() => {
  delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture;
  vi.restoreAllMocks();
});

describe('useDocumentPiP fallback (unsupported browsers)', () => {
  it('reports not supported when the API is absent (Safari/Firefox)', () => {
    expect(isDocumentPiPSupported()).toBe(false);
    const { result } = renderHook(() => useDocumentPiP());
    expect(result.current.isSupported).toBe(false);
  });

  it('open() resolves false and stays closed when unsupported — caller falls back in-page', async () => {
    const { result } = renderHook(() => useDocumentPiP());
    let opened = true;
    await act(async () => {
      opened = await result.current.open();
    });
    expect(opened).toBe(false);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.container).toBeNull();
  });
});

describe('useDocumentPiP supported path', () => {
  function installFakePiP() {
    const pipDoc = document.implementation.createHTMLDocument('pip');
    const listeners: Record<string, EventListener[]> = {};
    const pipWindow = {
      document: pipDoc,
      addEventListener: (type: string, cb: EventListener) => {
        (listeners[type] ||= []).push(cb);
      },
      close: vi.fn(),
      _fire: (type: string) => (listeners[type] || []).forEach((cb) => cb(new Event(type))),
    };
    const requestWindow = vi.fn(async () => pipWindow as unknown as Window);
    (window as unknown as { documentPictureInPicture: unknown }).documentPictureInPicture = {
      requestWindow,
      window: null,
    };
    return { pipWindow, requestWindow };
  }

  it('opens a window, exposes a container, and copies styles', async () => {
    // Seed an opener stylesheet to prove it is copied into the PiP document.
    const style = document.createElement('style');
    style.textContent = '.x{color:red}';
    document.head.appendChild(style);

    const { pipWindow, requestWindow } = installFakePiP();
    const { result } = renderHook(() => useDocumentPiP());

    expect(result.current.isSupported).toBe(true);

    let ok = false;
    await act(async () => {
      ok = await result.current.open();
    });

    expect(ok).toBe(true);
    expect(requestWindow).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.container?.id).toBe('pip-root');
    expect(pipWindow.document.head.querySelector('style')?.textContent).toContain('.x{color:red}');

    document.head.removeChild(style);
  });

  it('paints the PiP document html/body dark on open (no white halo, issue #71 B2)', async () => {
    const { pipWindow } = installFakePiP();
    const { result } = renderHook(() => useDocumentPiP());

    await act(async () => {
      await result.current.open();
    });

    // jsdom normalizes hsl(240 10% 4%) → rgb(9, 9, 11): the dark canvas.
    expect(pipWindow.document.body.style.background).toBe('rgb(9, 9, 11)');
    expect(pipWindow.document.documentElement.style.background).toBe('rgb(9, 9, 11)');
    expect(pipWindow.document.body.style.margin).toBe('0px');
  });

  it('resets state when the user closes the PiP window (pagehide)', async () => {
    const { pipWindow } = installFakePiP();
    const { result } = renderHook(() => useDocumentPiP());

    await act(async () => {
      await result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      (pipWindow as unknown as { _fire: (t: string) => void })._fire('pagehide');
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.container).toBeNull();
  });

  it('open() is idempotent while a window is already open', async () => {
    const { requestWindow } = installFakePiP();
    const { result } = renderHook(() => useDocumentPiP());

    await act(async () => {
      await result.current.open();
    });
    await act(async () => {
      await result.current.open();
    });

    expect(requestWindow).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(true);
  });

  it('can re-open as a PiP window after the previous one was closed (pop-out flow)', async () => {
    const { pipWindow, requestWindow } = installFakePiP();
    const { result } = renderHook(() => useDocumentPiP());

    await act(async () => {
      await result.current.open();
    });
    act(() => {
      (pipWindow as unknown as { _fire: (t: string) => void })._fire('pagehide');
    });
    expect(result.current.isOpen).toBe(false);

    await act(async () => {
      await result.current.open();
    });

    expect(requestWindow).toHaveBeenCalledTimes(2);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.container?.id).toBe('pip-root');
  });
});
