// Módulo `presenca` — testes da LÓGICA PURA de atuação. Slice 5 (#81). ADR 0007.
//
// O coração testável da Presença é client-side e puro (espelha computeTaskTime
// do Mtech): máquina de ociosidade (ativo→idle→ativo), derivação de `atuando`
// (= focado ∧ ¬idle) e agregação do presence-state cru por demanda. Tudo aqui é
// função pura — sem React, sem Supabase, sem DOM — testável com fake timers.
//
// Invariante de domínio (CONTEXT.md → Presença/Atuação): online ≠ atuando.
// "Presença" = demanda em foco agora. "Atuação" = Presença MENOS ociosidade:
// sem input por ~limiar → auto-pausa (o almoço com a aba aberta NÃO conta).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  IDLE_LIMIAR_MS_PADRAO,
  criarEstadoAtuacao,
  registrarInput,
  estaIdle,
  derivarAtuando,
  agregarPorDemanda,
  type EstadoAtuacao,
  type PresencaCrua,
} from "./atuacao";

describe("máquina de ociosidade — estaIdle / registrarInput", () => {
  it("não está idle imediatamente após o último input", () => {
    const est = criarEstadoAtuacao(1_000); // ultimoInputEm = 1000ms
    expect(estaIdle(est, 1_000)).toBe(false);
  });

  it("não está idle enquanto dentro do limiar", () => {
    const est = criarEstadoAtuacao(0);
    expect(estaIdle(est, IDLE_LIMIAR_MS_PADRAO - 1)).toBe(false);
  });

  it("vira idle exatamente no limiar (>=)", () => {
    const est = criarEstadoAtuacao(0);
    expect(estaIdle(est, IDLE_LIMIAR_MS_PADRAO)).toBe(true);
  });

  it("está idle bem além do limiar (almoço com aba aberta)", () => {
    const est = criarEstadoAtuacao(0);
    const meiaHora = 30 * 60 * 1_000;
    expect(estaIdle(est, meiaHora)).toBe(true);
  });

  it("registrar input reseta o relógio de ociosidade (idle→ativo)", () => {
    const est0 = criarEstadoAtuacao(0);
    // passou do limiar → idle
    expect(estaIdle(est0, IDLE_LIMIAR_MS_PADRAO + 5)).toBe(true);
    // chega input em t=limiar+5 → reativa
    const est1 = registrarInput(est0, IDLE_LIMIAR_MS_PADRAO + 5);
    expect(estaIdle(est1, IDLE_LIMIAR_MS_PADRAO + 6)).toBe(false);
  });

  it("registrarInput é puro (não muta o estado anterior)", () => {
    const est0 = criarEstadoAtuacao(0);
    const est1 = registrarInput(est0, 5_000);
    expect(est0.ultimoInputEm).toBe(0);
    expect(est1.ultimoInputEm).toBe(5_000);
    expect(est1).not.toBe(est0);
  });

  it("respeita um limiar configurável (não fixo em 5 min)", () => {
    const limiar = 10_000; // 10s
    const est = criarEstadoAtuacao(0, limiar);
    expect(estaIdle(est, 9_999)).toBe(false);
    expect(estaIdle(est, 10_000)).toBe(true);
  });
});

describe("derivação de `atuando` — online ≠ atuando", () => {
  const base = (over: Partial<EstadoAtuacao> = {}): EstadoAtuacao => ({
    ...criarEstadoAtuacao(0),
    ...over,
  });

  it("atuando=false quando a demanda NÃO está focada (mesmo com input recente)", () => {
    const est = base({ focado: false });
    expect(derivarAtuando(est, 10)).toBe(false);
  });

  it("atuando=true quando focado E dentro do limiar de input", () => {
    const est = base({ focado: true });
    expect(derivarAtuando(est, IDLE_LIMIAR_MS_PADRAO - 1)).toBe(true);
  });

  it("atuando=false quando focado mas IDLE (auto-pausa: almoço com aba aberta)", () => {
    const est = base({ focado: true });
    expect(derivarAtuando(est, IDLE_LIMIAR_MS_PADRAO)).toBe(false);
  });

  it("retomar input reativa atuação (idle→ativo→atuando)", () => {
    let est = base({ focado: true });
    const tIdle = IDLE_LIMIAR_MS_PADRAO + 1_000;
    expect(derivarAtuando(est, tIdle)).toBe(false); // auto-pausado
    est = registrarInput(est, tIdle); // mexeu o mouse
    expect(derivarAtuando(est, tIdle + 1)).toBe(true); // reativou
  });
});

describe("agregação do presence-state por demanda", () => {
  const p = (userId: string, demandaId: string, atuando: boolean): PresencaCrua => ({
    user_id: userId,
    demanda_id: demandaId,
    atuando,
  });

  it("estado vazio → mapa vazio", () => {
    expect(agregarPorDemanda([])).toEqual({});
  });

  it("agrupa usuários por demanda", () => {
    const mapa = agregarPorDemanda([
      p("u1", "d1", true),
      p("u2", "d1", false),
      p("u3", "d2", true),
    ]);
    expect(Object.keys(mapa).sort()).toEqual(["d1", "d2"]);
    expect(mapa.d1.map((x) => x.user_id).sort()).toEqual(["u1", "u2"]);
    expect(mapa.d2.map((x) => x.user_id)).toEqual(["u3"]);
  });

  it("preserva o flag atuando de cada presença (online ≠ atuando)", () => {
    const mapa = agregarPorDemanda([p("u1", "d1", true), p("u2", "d1", false)]);
    const u1 = mapa.d1.find((x) => x.user_id === "u1");
    const u2 = mapa.d1.find((x) => x.user_id === "u2");
    expect(u1?.atuando).toBe(true);
    expect(u2?.atuando).toBe(false);
  });

  it("deduplica múltiplas presenças do mesmo usuário na mesma demanda (multi-aba) — última vence", () => {
    // Realtime Presence pode emitir >1 entrada por usuário (várias abas/sockets).
    // Para o badge, um usuário aparece UMA vez por demanda; o mais 'atuando' vence
    // (se qualquer sessão está atuando, a pessoa está atuando).
    const mapa = agregarPorDemanda([
      p("u1", "d1", false),
      p("u1", "d1", true),
    ]);
    expect(mapa.d1).toHaveLength(1);
    expect(mapa.d1[0].atuando).toBe(true);
  });

  it("ignora entradas sem demanda_id (usuário no canal mas sem demanda focada)", () => {
    const mapa = agregarPorDemanda([
      { user_id: "u1", demanda_id: null, atuando: false },
      p("u2", "d1", true),
    ]);
    expect(Object.keys(mapa)).toEqual(["d1"]);
  });
});

describe("integração temporal com fake timers (espelha computeTaskTime)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ciclo completo: ativo → (5min sem input) idle/auto-pausa → input → ativo", () => {
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
    const t0 = Date.now();
    let est = criarEstadoAtuacao(t0);
    est = { ...est, focado: true };

    // logo após focar: atuando
    expect(derivarAtuando(est, Date.now())).toBe(true);

    // avança 5 min sem input → auto-pausa
    vi.advanceTimersByTime(IDLE_LIMIAR_MS_PADRAO);
    expect(derivarAtuando(est, Date.now())).toBe(false);

    // mexe o mouse → reativa
    est = registrarInput(est, Date.now());
    expect(derivarAtuando(est, Date.now())).toBe(true);
  });
});
