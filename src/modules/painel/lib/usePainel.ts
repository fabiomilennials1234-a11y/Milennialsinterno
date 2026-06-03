// Módulo `painel` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 8 (#84) — estado de UI sobre o contrato de agregação. Encapsula react-query
// por cima do wrapper puro `lerPainelDoUsuario`: UMA query traz o board frio inteiro
// (demandas + tempo somado de todos os clientes visíveis). A UI consome ESTE hook;
// o wrapper e a lógica de agrupamento continuam testáveis sem React.
//
// O estado VIVO (quem atua AGORA) NÃO vem daqui — vem do canal Realtime efêmero,
// assinado LAZY por viewport no board (decisão de escala #84). Aqui é o estado frio,
// revalidado em janela curta; o "agora" é sobreposto no client.

import { useQuery } from "@tanstack/react-query";
import { lerPainelDoUsuario } from "./painel";
import type { LinhaPainel } from "./agrupar";

function chave() {
  return ["painel", "do_usuario"] as const;
}

/**
 * Lê o painel agregado do usuário (audiência herdada via contrato). `staleTime`
 * curto: o tempo acumulado evolui conforme intervalos fecham; a UI revalida ao
 * focar/refetch. Não é realtime — o "agora" é o badge live por viewport.
 */
export function usePainel() {
  return useQuery<LinhaPainel[]>({
    queryKey: chave(),
    staleTime: 30_000,
    queryFn: lerPainelDoUsuario,
  });
}
