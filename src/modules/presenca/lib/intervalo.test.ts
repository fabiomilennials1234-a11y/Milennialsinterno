// Módulo `presenca` — testes da LÓGICA PURA de intervalo. Slice 6 (#83). ADR 0007.
//
// Tempo-na-demanda (CONTEXT.md) = SOMA dos intervalos de Atuação. A persistência
// grava SÓ o intervalo FECHADO, na borda atuando:true→false — NÃO por heartbeat.
// Quando fechar (sem perder tempo nem duplicar) é decidido por ESTA lógica pura,
// não pelo hook: o hook só observa `atuando` e delega.
//
// Invariantes provados aqui:
//   - abre na borda false→true; fecha (emite intervalo) na borda true→false;
//   - heartbeat com `atuando` inalterado NÃO emite (sem duplicar);
//   - idle NÃO conta: a janela ociosa fica FORA de qualquer intervalo;
//   - retomada abre um NOVO intervalo (intervalos disjuntos);
//   - flush (pagehide/unmount) fecha o intervalo aberto em `agora` (não perde o
//     último), e é idempotente (flush sem aberto não emite, não duplica).

import { describe, it, expect } from "vitest";
import {
  intervaloVazio,
  transicionarIntervalo,
  flushIntervalo,
  type RastreadorIntervalo,
} from "./intervalo";

describe("transicionarIntervalo — abre/fecha na borda de `atuando`", () => {
  it("começa sem intervalo aberto", () => {
    expect(intervaloVazio().abertoEm).toBeNull();
  });

  it("borda false→true ABRE o intervalo, sem emitir", () => {
    const r = transicionarIntervalo(intervaloVazio(), true, 1_000);
    expect(r.estado.abertoEm).toBe(1_000);
    expect(r.fechado).toBeNull();
  });

  it("`atuando` true continuado (heartbeat) NÃO reabre nem emite (sem duplicar)", () => {
    let r = transicionarIntervalo(intervaloVazio(), true, 1_000);
    const aberto = r.estado;
    r = transicionarIntervalo(aberto, true, 31_000); // heartbeat 30s depois
    expect(r.estado.abertoEm).toBe(1_000); // mesmo início, não reabriu
    expect(r.fechado).toBeNull(); // nada emitido
  });

  it("borda true→false FECHA e emite o intervalo [abertoEm, agora]", () => {
    let r = transicionarIntervalo(intervaloVazio(), true, 1_000);
    r = transicionarIntervalo(r.estado, false, 601_000); // 10 min depois
    expect(r.estado.abertoEm).toBeNull();
    expect(r.fechado).toEqual({ inicio: 1_000, fim: 601_000 });
  });

  it("`atuando` false continuado (sem aberto) NÃO emite", () => {
    let r = transicionarIntervalo(intervaloVazio(), false, 1_000);
    expect(r.fechado).toBeNull();
    r = transicionarIntervalo(r.estado, false, 2_000);
    expect(r.fechado).toBeNull();
  });
});

describe("idle não conta + retomada → intervalos disjuntos", () => {
  it("idle (true→false) fecha o intervalo ANTES da janela ociosa; a ociosidade fica de fora", () => {
    // t=0 abre; t=300_000 (5min) vira idle → `atuando` cai para false NESSE ponto.
    let r = transicionarIntervalo(intervaloVazio(), true, 0);
    r = transicionarIntervalo(r.estado, false, 300_000);
    expect(r.fechado).toEqual({ inicio: 0, fim: 300_000 });
    // a janela [300_000, ...] ociosa não está em nenhum intervalo (não conta).
  });

  it("retomada após idle abre um NOVO intervalo disjunto", () => {
    // intervalo 1: [0, 300_000]; ocioso; retoma em 900_000; fecha em 1_200_000.
    let r = transicionarIntervalo(intervaloVazio(), true, 0);
    r = transicionarIntervalo(r.estado, false, 300_000);
    const i1 = r.fechado;
    r = transicionarIntervalo(r.estado, true, 900_000); // retomou (novo input)
    expect(r.estado.abertoEm).toBe(900_000);
    expect(r.fechado).toBeNull();
    r = transicionarIntervalo(r.estado, false, 1_200_000);
    const i2 = r.fechado;
    expect(i1).toEqual({ inicio: 0, fim: 300_000 });
    expect(i2).toEqual({ inicio: 900_000, fim: 1_200_000 });
    // disjuntos: i1.fim (300_000) < i2.inicio (900_000). A soma = 300s + 300s = 600s.
    const somaSeg = ((i1!.fim - i1!.inicio) + (i2!.fim - i2!.inicio)) / 1000;
    expect(somaSeg).toBe(600);
  });
});

describe("flushIntervalo — fechar-aba/unmount sem perder o último intervalo", () => {
  it("flush com intervalo ABERTO fecha em `agora` e emite", () => {
    const r0 = transicionarIntervalo(intervaloVazio(), true, 1_000);
    const f = flushIntervalo(r0.estado, 5_000);
    expect(f.fechado).toEqual({ inicio: 1_000, fim: 5_000 });
    expect(f.estado.abertoEm).toBeNull();
  });

  it("flush SEM intervalo aberto é no-op (idempotente, não duplica)", () => {
    const f1 = flushIntervalo(intervaloVazio(), 5_000);
    expect(f1.fechado).toBeNull();
    // flush duplo após já ter fechado: segundo flush não emite de novo.
    const r0 = transicionarIntervalo(intervaloVazio(), true, 1_000);
    const f2 = flushIntervalo(r0.estado, 5_000);
    const f3 = flushIntervalo(f2.estado, 6_000);
    expect(f2.fechado).toEqual({ inicio: 1_000, fim: 5_000 });
    expect(f3.fechado).toBeNull();
  });

  it("flush degenerado (agora <= abertoEm) NÃO emite intervalo inválido", () => {
    const r0 = transicionarIntervalo(intervaloVazio(), true, 5_000);
    const f = flushIntervalo(r0.estado, 5_000); // mesmo instante → duração zero
    expect(f.fechado).toBeNull();
    expect(f.estado.abertoEm).toBeNull();
  });
});
