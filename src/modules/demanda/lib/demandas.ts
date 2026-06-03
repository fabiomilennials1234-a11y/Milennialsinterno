// Módulo `demanda` — INTERNAL. Não importar de fora do módulo.
// Acesso público só via o barrel `src/modules/demanda/index.ts`.
//
// Slice 4 (#80) — wrappers tipados do contrato do módulo `demanda` (ADR 0004).
// Em outros módulos / na UI, a forma de mexer/ler Demandas é importar estas funções
// do barrel — nunca chamar a RPC nem ler demanda.demandas direto.
// Ver ADR 0004 (contrato-only) e CONTEXT.md → "Demanda".
import { supabase } from "@/integrations/supabase/client";

/** Domínio/área de uma demanda. uuid solto no banco; aqui é texto livre por enquanto. */
export type DominioDemanda = string;

export interface Demanda {
  id: string;
  client_id: string;
  titulo: string;
  status: string;
  dominio: string | null;
  created_at: string;
}

/**
 * Lista as demandas de um cliente (contrato `demanda.do_cliente`).
 * Audiência herdada: só quem pode ver o cliente recebe linhas; não-autorizado
 * recebe array vazio (semântica "200+vazio", não erro). Ver ADR 0005.
 */
export async function listarDemandasDoCliente(clientId: string): Promise<Demanda[]> {
  const { data, error } = await supabase
    .schema("demanda")
    .rpc("do_cliente", { p_client_id: clientId });
  if (error) throw error;
  return (data ?? []) as Demanda[];
}

/**
 * Cria uma demanda para um cliente (contrato `demanda.criar`).
 * Valida existência do cliente (anti-órfão) e autoriza por pode_ver_cliente.
 * @returns o id da demanda criada.
 */
export async function criarDemanda(
  clientId: string,
  titulo: string,
  dominio?: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .schema("demanda")
    .rpc("criar", {
      p_client_id: clientId,
      p_titulo: titulo,
      p_dominio: dominio ?? null,
    });
  if (error) throw error;
  return data as string;
}

/**
 * Vincula um card de domínio (kanban_card) a uma demanda (contrato
 * `demanda.vincular_card`). Anti-órfão duplo (demanda + card); autoriza por
 * pode_ver_cliente do cliente dono da demanda.
 */
export async function vincularCard(
  demandaId: string,
  cardRef: string,
): Promise<void> {
  const { error } = await supabase
    .schema("demanda")
    .rpc("vincular_card", {
      p_demanda_id: demandaId,
      p_card_ref: cardRef,
    });
  if (error) throw error;
}
