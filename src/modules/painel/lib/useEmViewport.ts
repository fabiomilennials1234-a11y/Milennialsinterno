// Módulo `painel` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 8 (#84) — primitivo da DECISÃO DE ESCALA: diz se um elemento está (ou
// esteve recentemente) no viewport. Alimenta o `ativo` de usePresencaLazy — só
// grupos visíveis assinam seu canal Realtime. `rootMargin` generoso pré-assina
// um pouco antes de entrar e segura um pouco depois de sair, evitando flicker de
// (des)assinatura ao rolar. Uma vez visível, mantém `true` por `manterMs` após
// sair — assinar/desassinar a cada micro-scroll seria pior que assinar de menos.

import { useEffect, useRef, useState } from "react";

export interface OpcoesEmViewport {
  /** Margem do root (pré-carrega antes de entrar). Default: 200px. */
  rootMargin?: string;
  /** Mantém `true` por este tempo após sair do viewport (anti-flicker). Default 5s. */
  manterMs?: number;
}

/**
 * Retorna `[ref, ativo]`. Conecte `ref` ao elemento do grupo; `ativo` fica true
 * enquanto visível e por `manterMs` após sair. SSR/sem IntersectionObserver →
 * cai em `true` (degrada para o comportamento atual: assina; nunca esconde dado).
 */
export function useEmViewport<T extends HTMLElement = HTMLDivElement>(
  opcoes: OpcoesEmViewport = {},
): [React.RefObject<T>, boolean] {
  const { rootMargin = "200px", manterMs = 5_000 } = opcoes;
  const ref = useRef<T>(null);
  const [ativo, setAtivo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      // Ambiente sem IO (SSR/teste antigo): degrada para "sempre ativo".
      setAtivo(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
          }
          setAtivo(true);
        } else {
          // Saiu do viewport: segura por manterMs antes de desassinar (anti-flicker).
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setAtivo(false), manterMs);
        }
      },
      { rootMargin, threshold: 0 },
    );

    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [rootMargin, manterMs]);

  return [ref, ativo];
}
