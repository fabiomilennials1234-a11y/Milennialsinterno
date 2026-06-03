// Módulo `demanda` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 4 (#80) — estado de UI sobre o contrato de Demanda.
// Encapsula react-query (cache/invalidação/erro) por cima dos wrappers puros de
// `demandas.ts`. A UI consome ESTE hook; os wrappers continuam testáveis sem React.

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarDemandasDoCliente,
  criarDemanda,
  vincularCard,
  type Demanda,
} from "./demandas";

function chaveLista(clientId: string) {
  return ["demanda", "do_cliente", clientId] as const;
}

/** Lista as demandas de um cliente (audiência herdada via contrato). */
export function useDemandas(clientId: string) {
  return useQuery<Demanda[]>({
    queryKey: chaveLista(clientId),
    enabled: Boolean(clientId),
    staleTime: 30_000,
    queryFn: () => listarDemandasDoCliente(clientId),
  });
}

/** Mutations do módulo, com invalidação da lista do cliente. */
export function useDemandaMutations(clientId: string) {
  const qc = useQueryClient();
  const invalidar = useCallback(
    () => qc.invalidateQueries({ queryKey: chaveLista(clientId) }),
    [qc, clientId],
  );

  const criar = useMutation({
    mutationFn: (v: { titulo: string; dominio?: string | null }) =>
      criarDemanda(clientId, v.titulo, v.dominio ?? null),
    onSuccess: invalidar,
  });

  const vincular = useMutation({
    mutationFn: (v: { demandaId: string; cardRef: string }) =>
      vincularCard(v.demandaId, v.cardRef),
    onSuccess: invalidar,
  });

  return { criar, vincular };
}
