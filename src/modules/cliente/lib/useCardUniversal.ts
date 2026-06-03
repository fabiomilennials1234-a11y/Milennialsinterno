// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 1 (#77) — estado de UI sobre o contrato de leitura do Card Universal.
// Encapsula react-query (cache/erro) por cima do wrapper puro `cardUniversal.ts`.
// A UI consome ESTE hook; o wrapper continua testável sem React (cardUniversal.test.ts).
//
// Read-mostly: staleTime alto (o banco de info muda raramente). A edição é #79;
// quando existir, invalida-se esta chave.
import { useQuery } from "@tanstack/react-query";
import { lerCardUniversal, type CardUniversal } from "./cardUniversal";

function chaveCard(clientId: string) {
  return ["cliente", "card-universal", clientId] as const;
}

/**
 * Lê o Card Universal de um cliente. `data` é `null` quando o caller não pode
 * ver o cliente (gate de audiência) ou não há card ainda — a UI distingue
 * carregando / sem-acesso-ou-vazio / com-dados.
 */
export function useCardUniversal(clientId: string) {
  return useQuery<CardUniversal | null>({
    queryKey: chaveCard(clientId),
    enabled: Boolean(clientId),
    staleTime: 60_000,
    queryFn: () => lerCardUniversal(clientId),
  });
}
