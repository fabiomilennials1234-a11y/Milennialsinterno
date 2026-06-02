/**
 * useDocumentPiP — opens a Document Picture-in-Picture window and exposes a
 * container element for React to portal into.
 *
 * The PiP window floats always-on-top over ANY application (not just the
 * browser tab), which is the whole point of the recording overlay (see
 * docs/adr/0001). It is Chromium-only — `isSupported` is false on Firefox/
 * Safari, and callers MUST fall back to an in-page portal there.
 *
 * This hook owns ONLY the window surface. It does not own recording state —
 * useRecordingOrchestrator remains the single source of truth; the PiP is just
 * an additional render target.
 *
 * A Document PiP window starts with an empty document that inherits NO CSS from
 * the opener, so we copy the opener's stylesheets (adopted + <style>/<link>)
 * into it on open. Without this, Tailwind/theme classes render unstyled.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface DocumentPiPWindowOptions {
  width?: number;
  height?: number;
}

interface DocumentPictureInPicture {
  requestWindow: (options?: DocumentPiPWindowOptions) => Promise<Window>;
  window: Window | null;
}

function getPiP(): DocumentPictureInPicture | undefined {
  return (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture })
    .documentPictureInPicture;
}

export const isDocumentPiPSupported = (): boolean => typeof getPiP()?.requestWindow === 'function';

function copyStyles(target: Document): void {
  // 1. Constructable stylesheets adopted by the opener (Vite/Tailwind may use these).
  try {
    const adopted = (document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets;
    if (adopted?.length) {
      (target as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets = [...adopted];
    }
  } catch {
    // Cross-origin or unsupported — fall through to node cloning below.
  }

  // 2. <style> and <link rel="stylesheet"> nodes from <head>.
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    target.head.appendChild(node.cloneNode(true));
  });

  // Inherit the dark/light theme class the app sets on <html>.
  target.documentElement.className = document.documentElement.className;
}

export interface UseDocumentPiPReturn {
  isSupported: boolean;
  isOpen: boolean;
  container: HTMLElement | null;
  open: () => Promise<boolean>;
  close: () => void;
}

export function useDocumentPiP(options?: DocumentPiPWindowOptions): UseDocumentPiPReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const isSupported = isDocumentPiPSupported();

  const close = useCallback(() => {
    pipWindowRef.current?.close();
    pipWindowRef.current = null;
    setContainer(null);
    setIsOpen(false);
  }, []);

  const open = useCallback(async (): Promise<boolean> => {
    const pip = getPiP();
    if (!pip?.requestWindow) return false;
    if (pipWindowRef.current) return true; // already open

    try {
      const pipWindow = await pip.requestWindow({
        width: options?.width ?? 320,
        height: options?.height ?? 180,
      });

      copyStyles(pipWindow.document);

      // The PiP document's html/body inherit nothing and default to white. Paint
      // them with the dark canvas up front so no white halo flashes around the
      // always-on-top window before/around the overlay paints (issue #71 B2).
      const canvas = 'hsl(240 10% 4%)';
      pipWindow.document.documentElement.style.background = canvas;
      pipWindow.document.body.style.background = canvas;
      pipWindow.document.body.style.margin = '0';

      const root = pipWindow.document.createElement('div');
      root.id = 'pip-root';
      pipWindow.document.body.appendChild(root);

      // The user closing the PiP window must reset our state.
      pipWindow.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
        setContainer(null);
        setIsOpen(false);
      });

      pipWindowRef.current = pipWindow;
      setContainer(root);
      setIsOpen(true);
      return true;
    } catch {
      // User dismissed the permission, or the window failed to open.
      return false;
    }
  }, [options?.width, options?.height]);

  // Ensure the PiP window is torn down if the host component unmounts.
  useEffect(() => {
    return () => {
      pipWindowRef.current?.close();
      pipWindowRef.current = null;
    };
  }, []);

  return { isSupported, isOpen, container, open, close };
}
