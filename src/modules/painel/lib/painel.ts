// Módulo `painel` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 8 (#84) — wrapper tipado do CONTRATO de agregação `demanda.painel_do_usuario`.
// A forma de ler o board "Monday" agregado é importar esta função (ou o hook) do
// barrel — nunca chamar a RPC direto. Ver ADR 0004 (contrato-only) e ADR 0005.
//
// NOTA DE TIPAGEM (ADR 0004 / decisão #83 reusada): o schema `demanda` é exposto no
// PostgREST e parcialmente no gerador, MAS `painel_do_usuario` é uma RPC nova e o
// gerador (`supabase:gen-types`) regeneraria todo o public a partir do remoto,
// ENTRELAÇANDO o types.ts com o trabalho concorrente do Torque CRM no working tree.
// Como o contrato já define a forma na fronteira do wrapper, tipamos local e
// mantemos types.ts intacto — os casts `as never` ficam confinados a este arquivo.

import { supabase } from "@/integrations/supabase/client";
import type { LinhaPainel } from "./agrupar";

/**
 * Lê o painel agregado do usuário (contrato `demanda.painel_do_usuario`): TODAS as
 * demandas de TODOS os clientes que o caller pode ver, com nome do cliente e
 * Tempo-na-demanda somado, numa só query. Audiência herdada (ADR 0005): o escopo é
 * o próprio caller no banco; não-autorizado recebe array vazio (não erro).
 */
export async function lerPainelDoUsuario(): Promise<LinhaPainel[]> {
  const { data, error } = await supabase
    .schema("demanda" as never)
    .rpc("painel_do_usuario" as never);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    demanda_id: string;
    client_id: string;
    client_nome: string;
    titulo: string;
    status: string;
    dominio: string | null;
    created_at: string;
    tempo_segundos: number | string;
  }>;
  // segundos chega como bigint (string no JSON via PostgREST) — normaliza para number.
  return rows.map((r) => ({
    demanda_id: r.demanda_id,
    client_id: r.client_id,
    client_nome: r.client_nome,
    titulo: r.titulo,
    status: r.status,
    dominio: r.dominio,
    created_at: r.created_at,
    tempo_segundos: Number(r.tempo_segundos),
  }));
}
