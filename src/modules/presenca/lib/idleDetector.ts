// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 5 (#81) — detector de ociosidade: camada FINA e impura que liga
// listeners de input/foco do DOM e delega à lógica pura (atuacao.ts). Mantida
// minúscula de propósito — toda decisão (idle? atuando?) vive em atuacao.ts e é
// testada lá; aqui só se faz a ponte com o browser (coberto por E2E ao vivo).

/** Eventos de input que indicam atividade humana (resetam o relógio idle). */
const EVENTOS_INPUT: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
];

export interface IdleDetectorOpts {
  /** chamado a cada input humano, com o epoch ms do evento. */
  onInput: (agora: number) => void;
  /** chamado quando a visibilidade da aba muda (foco/blur de presença). */
  onVisibilidade: (visivel: boolean) => void;
  /** opcional: alvo dos listeners (default: window/document). Para testes. */
  alvo?: Pick<Window, "addEventListener" | "removeEventListener">;
}

/**
 * Liga os listeners e devolve um disposer. throttle leve em memória evita
 * floodar o callback em mousemove — a granularidade do idle é minutos, não ms.
 */
export function ligarIdleDetector(opts: IdleDetectorOpts): () => void {
  const alvo = opts.alvo ?? window;
  let ultimoDisparo = 0;
  const THROTTLE_MS = 1_000;

  const handleInput = () => {
    const agora = Date.now();
    if (agora - ultimoDisparo < THROTTLE_MS) return;
    ultimoDisparo = agora;
    opts.onInput(agora);
  };

  const handleVisibilidade = () => {
    opts.onVisibilidade(document.visibilityState === "visible");
  };

  for (const ev of EVENTOS_INPUT) {
    alvo.addEventListener(ev, handleInput, { passive: true });
  }
  document.addEventListener("visibilitychange", handleVisibilidade);

  return () => {
    for (const ev of EVENTOS_INPUT) {
      alvo.removeEventListener(ev, handleInput);
    }
    document.removeEventListener("visibilitychange", handleVisibilidade);
  };
}
