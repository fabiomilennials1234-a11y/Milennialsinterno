// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 6 (#83) — estado de UI sobre o contrato de Tempo-na-demanda.
// Encapsula react-query por cima do wrapper puro `tempoPorDemandaDoCliente`: busca
// o tempo acumulado de TODAS as demandas de um cliente numa só query (evita N
// requests no modal). A UI consome ESTE hook; o wrapper continua testável sem React.
//
// Audiência herdada (ADR 0005): não-autorizado recebe vazio (não erro). O número é
// o "há quanto tempo se atua" honesto = soma dos intervalos de atuação (CONTEXT.md).

import { useQuery } from "@tanstack/react-query";
import { tempoPorDemandaDoCliente } from "./intervalos";

function chave(clientId: string) {
  return ["presenca", "tempo_por_demanda", clientId] as const;
}

export interface TempoPorDemanda {
  /** demandaId -> segundos acumulados de atuação. Demandas sem tempo não aparecem. */
  porDemanda: Record<string, number>;
}

/**
 * Tempo acumulado por demanda de um cliente. `staleTime` curto: o número evolui
 * conforme intervalos fecham; a UI revalida ao reabrir/refetch. Não é realtime —
 * o "agora" (quem atua) é o badge live (canal Realtime); aqui é o histórico somado.
 */
export function useTempoNaDemanda(clientId: string | null | undefined): {
  porDemanda: Record<string, number>;
  isLoading: boolean;
} {
  const q = useQuery({
    queryKey: chave(clientId ?? ""),
    enabled: Boolean(clientId),
    staleTime: 60_000,
    queryFn: () => tempoPorDemandaDoCliente(clientId as string),
  });

  const porDemanda: Record<string, number> = {};
  for (const t of q.data ?? []) porDemanda[t.demandaId] = t.segundos;

  return { porDemanda, isLoading: q.isLoading };
}

/** Formata segundos em rótulo curto e honesto: "—", "12 min", "3 h 5 min", "2 h". */
export function formatarTempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "—";
  const totalMin = Math.floor(segundos / 60);
  if (totalMin < 1) return "<1 min";
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min} min`;
  if (min === 0) return `${h} h`;
  return `${h} h ${min} min`;
}
