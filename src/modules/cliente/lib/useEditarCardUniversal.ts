// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 3 (#79) — mutation de ESCRITA do Card Universal sobre o wrapper puro
// `editarCardUniversal.ts`. A UI de edição consome ESTE hook; o wrapper continua
// testável sem React (editarCardUniversal.test.ts).
//
// Invalida a chave de leitura ["cliente","card-universal",id] (mesma do
// useCardUniversal) no sucesso → o painel read-mostly reflete a edição sem reload.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editarCardUniversal, type EdicaoCardUniversal } from "./editarCardUniversal";

function chaveCard(clientId: string) {
  return ["cliente", "card-universal", clientId] as const;
}

/**
 * Edita o Card Universal de um cliente. No sucesso, invalida a leitura do card
 * desse cliente (sincroniza o painel). Erros (42501 / P0002) propagam para a UI
 * tratar (toast / estado de permissão) — o hook não os engole.
 *
 * @param clientId uuid do cliente cujo card será editado
 */
export function useEditarCardUniversal(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: EdicaoCardUniversal) => editarCardUniversal(clientId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaveCard(clientId) });
    },
  });
}
