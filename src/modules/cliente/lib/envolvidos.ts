// Módulo `cliente` — INTERNAL. Não importar de fora do módulo.
// Acesso público só via o barrel `src/modules/cliente/index.ts`.
//
// Slice 2 (#78) — wrappers tipados do contrato de membership (Envolvido).
// Em outros módulos, a forma de mexer/ler Envolvidos é importar estas funções
// do barrel — nunca chamar a RPC nem ler cliente.client_members direto.
// Ver ADR 0005 e ADR 0004.
import { supabase } from "@/integrations/supabase/client";

/** Papel de um Envolvido no cliente (espelha cliente.client_members.papel_no_cliente). */
export type PapelNoCliente =
  | "ads_manager"
  | "comercial"
  | "crm"
  | "rh"
  | "outbound_manager"
  | "sucesso_cliente"
  | "mktplace"
  | "secondary_manager";

export interface Envolvido {
  user_id: string;
  papel_no_cliente: PapelNoCliente;
  entrou_em: string;
}

/**
 * Lista os Envolvidos de um cliente (contrato `cliente.membros`).
 * Só admin/envolvido recebe linhas (RLS no predicado da RPC).
 */
export async function listarEnvolvidos(clientId: string): Promise<Envolvido[]> {
  const { data, error } = await supabase
    .schema("cliente")
    .rpc("membros", { p_client_id: clientId });
  if (error) throw error;
  return (data ?? []) as Envolvido[];
}

/**
 * Adiciona um Envolvido (contrato `cliente.adicionar_membro`).
 * Idempotente; valida existência do cliente; autoriza admin OU já-envolvido.
 */
export async function adicionarEnvolvido(
  clientId: string,
  userId: string,
  papel: PapelNoCliente,
): Promise<void> {
  const { error } = await supabase
    .schema("cliente")
    .rpc("adicionar_membro", {
      p_client_id: clientId,
      p_user_id: userId,
      p_papel: papel,
    });
  if (error) throw error;
}

/**
 * Remove um Envolvido (contrato `cliente.remover_membro`).
 */
export async function removerEnvolvido(
  clientId: string,
  userId: string,
  papel: PapelNoCliente,
): Promise<void> {
  const { error } = await supabase
    .schema("cliente")
    .rpc("remover_membro", {
      p_client_id: clientId,
      p_user_id: userId,
      p_papel: papel,
    });
  if (error) throw error;
}
