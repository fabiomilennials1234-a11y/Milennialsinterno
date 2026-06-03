// Módulo `cliente` — INTERNAL. Não importar de fora do módulo.
// Acesso público só via o barrel `src/modules/cliente/index.ts`.
//
// Slice 0 (#76): wrapper tipado do contrato `cliente.existe(uuid)` (RPC
// SECURITY DEFINER). Em outros módulos, a forma de checar existência de cliente
// é importar `clienteExiste` do barrel — nunca chamar a RPC nem ler a tabela
// direto. Ver ADR 0004.
import { supabase } from "@/integrations/supabase/client";

/**
 * Predicado de existência de cliente — interface pública (contrato) do módulo
 * `cliente`. Chama a RPC `cliente.existe` no schema dedicado do módulo.
 *
 * @param clientId uuid do cliente
 * @returns true se o cliente existe, false caso contrário
 */
export async function clienteExiste(clientId: string): Promise<boolean> {
  const { data, error } = await supabase
    .schema("cliente")
    .rpc("existe", { p_client_id: clientId });
  if (error) throw error;
  return data === true;
}
