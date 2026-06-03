// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 5 (#81) — hook de ANÚNCIO: ao focar uma demanda, o usuário entra no
// canal de presença do cliente e faz track({ user_id, demanda_id, atuando }).
// `atuando` é inferido (foco + idle-aware): sem input por ~limiar → auto-pausa
// (CONTEXT.md → Atuação). Os demais veem em tempo real. ADR 0007.
//
// Slice 6 (#83) — PERSISTÊNCIA do Tempo-na-demanda. Além do track efêmero, fecha e
// grava o intervalo de atuação na borda atuando:true→false (pausa/idle/blur/troca/
// unmount) via o contrato `registrarIntervalo` — NÃO por heartbeat. O "quando
// fechar" é a lógica pura `transicionarIntervalo`/`flushIntervalo` (intervalo.ts);
// o hook só observa `atuando` e delega. No fechar-aba, flush durável via beacon
// (keepalive) para não perder o último (e maior) intervalo. Estado vivo segue no
// canal Realtime efêmero (ADR 0007); só o intervalo FECHADO toca o banco.

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { topicoPresencaCliente } from "./canal";
import {
  IDLE_LIMIAR_MS_PADRAO,
  criarEstadoAtuacao,
  derivarAtuando,
  registrarInput,
  type EstadoAtuacao,
} from "./atuacao";
import {
  intervaloVazio,
  transicionarIntervalo,
  flushIntervalo,
  type RastreadorIntervalo,
} from "./intervalo";
import { registrarIntervalo, beaconRegistrarIntervalo } from "./intervalos";
import { ligarIdleDetector } from "./idleDetector";

export interface UsePresencaDemandaArgs {
  clientId: string | null | undefined;
  demandaId: string | null | undefined;
  userId: string | null | undefined;
  /** desliga o anúncio sem desmontar (ex.: painel fechado). */
  ativo?: boolean;
  /** limiar de ociosidade em ms (testes/UX). Default 5 min. */
  idleLimiarMs?: number;
}

/**
 * Anuncia a atuação do usuário na demanda focada. Re-track periódico (heartbeat)
 * reavalia `atuando` — capturando a transição ativo→idle mesmo sem novo input.
 */
export function usePresencaDemanda({
  clientId,
  demandaId,
  userId,
  ativo = true,
  idleLimiarMs = IDLE_LIMIAR_MS_PADRAO,
}: UsePresencaDemandaArgs): { atuando: boolean } {
  const [atuando, setAtuando] = useState(false);
  const estadoRef = useRef<EstadoAtuacao>(criarEstadoAtuacao(Date.now(), idleLimiarMs));
  const canalRef = useRef<RealtimeChannel | null>(null);
  const inscritoRef = useRef(false);
  // Slice 6 (#83) — rastreador do intervalo de atuação aberto (lógica pura).
  const intervaloRef = useRef<RastreadorIntervalo>(intervaloVazio());

  const ligado = Boolean(ativo && clientId && demandaId && userId);

  useEffect(() => {
    if (!ligado || !clientId || !demandaId || !userId) {
      setAtuando(false);
      return;
    }

    // Estado inicial: focado, input agora. Intervalo começa fechado (abre ao atuar).
    estadoRef.current = { ...criarEstadoAtuacao(Date.now(), idleLimiarMs), focado: true };
    intervaloRef.current = intervaloVazio();

    const canal = supabase.channel(topicoPresencaCliente(clientId), {
      config: { private: true, presence: { key: userId } },
    });
    canalRef.current = canal;

    // Persiste UM intervalo fechado via contrato (borda true→false). Fire-and-forget:
    // a persistência NUNCA pode quebrar a UI de presença (erro só é engolido).
    const persistir = (inicio: number, fim: number) => {
      void registrarIntervalo(demandaId, inicio, fim).catch(() => {
        /* best-effort: presença viva não depende da persistência */
      });
    };

    const publicar = () => {
      if (!inscritoRef.current) return;
      const agora = Date.now();
      const agoraAtuando = derivarAtuando(estadoRef.current, agora);
      setAtuando(agoraAtuando);
      void canal.track({ user_id: userId, demanda_id: demandaId, atuando: agoraAtuando });

      // Borda de atuação → abre/fecha o intervalo (lógica pura decide o "quando").
      const r = transicionarIntervalo(intervaloRef.current, agoraAtuando, agora);
      intervaloRef.current = r.estado;
      if (r.fechado) persistir(r.fechado.inicio, r.fechado.fim);
    };

    const desligarIdle = ligarIdleDetector({
      onInput: (agora) => {
        estadoRef.current = registrarInput(estadoRef.current, agora);
        publicar();
      },
      onVisibilidade: (visivel) => {
        estadoRef.current = { ...estadoRef.current, focado: visivel };
        publicar();
      },
    });

    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        inscritoRef.current = true;
        publicar();
      }
    });

    // Heartbeat: reavalia atuando mesmo sem input novo (captura ativo→idle).
    const heartbeat = window.setInterval(publicar, 30_000);

    // Flush durável (fechar-aba/troca de app): fecha o intervalo ABERTO em `now()`
    // via beacon (keepalive sobrevive ao unload). Sem isso, o último (e maior)
    // intervalo se perderia justamente no caso comum — Tempo-na-demanda mentiria
    // por baixo. Idempotente: a lógica pura zera o aberto, então não duplica.
    const flushDuravel = () => {
      const f = flushIntervalo(intervaloRef.current, Date.now());
      intervaloRef.current = f.estado;
      if (!f.fechado) return;
      const token = canal.socket?.accessTokenValue ?? null;
      beaconRegistrarIntervalo(demandaId, f.fechado.inicio, f.fechado.fim, token);
    };
    const onPageHide = () => flushDuravel();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushDuravel();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      desligarIdle();
      inscritoRef.current = false;
      // Unmount / troca de demanda (aba sobrevive): fecha o intervalo aberto via
      // contrato normal (a chamada sai mesmo sem await completar).
      const f = flushIntervalo(intervaloRef.current, Date.now());
      intervaloRef.current = f.estado;
      if (f.fechado) {
        void registrarIntervalo(demandaId, f.fechado.inicio, f.fechado.fim).catch(() => {});
      }
      void canal.untrack();
      supabase.removeChannel(canal);
      canalRef.current = null;
      setAtuando(false);
    };
  }, [ligado, clientId, demandaId, userId, idleLimiarMs]);

  return { atuando };
}
