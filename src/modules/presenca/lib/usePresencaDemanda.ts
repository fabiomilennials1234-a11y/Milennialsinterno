// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 5 (#81) — hook de ANÚNCIO: ao focar uma demanda, o usuário entra no
// canal de presença do cliente e faz track({ user_id, demanda_id, atuando }).
// `atuando` é inferido (foco + idle-aware): sem input por ~limiar → auto-pausa
// (CONTEXT.md → Atuação). Os demais veem em tempo real. ADR 0007.
//
// Não persiste nada (#83 é a persistência de intervalo). Estado VIVO, em memória.
// Canal `private: true` (segurança — ver canal.ts).

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

  const ligado = Boolean(ativo && clientId && demandaId && userId);

  useEffect(() => {
    if (!ligado || !clientId || !demandaId || !userId) {
      setAtuando(false);
      return;
    }

    // Estado inicial: focado, input agora.
    estadoRef.current = { ...criarEstadoAtuacao(Date.now(), idleLimiarMs), focado: true };

    const canal = supabase.channel(topicoPresencaCliente(clientId), {
      config: { private: true, presence: { key: userId } },
    });
    canalRef.current = canal;

    const publicar = () => {
      if (!inscritoRef.current) return;
      const agoraAtuando = derivarAtuando(estadoRef.current, Date.now());
      setAtuando(agoraAtuando);
      void canal.track({ user_id: userId, demanda_id: demandaId, atuando: agoraAtuando });
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

    return () => {
      window.clearInterval(heartbeat);
      desligarIdle();
      inscritoRef.current = false;
      void canal.untrack();
      supabase.removeChannel(canal);
      canalRef.current = null;
      setAtuando(false);
    };
  }, [ligado, clientId, demandaId, userId, idleLimiarMs]);

  return { atuando };
}
