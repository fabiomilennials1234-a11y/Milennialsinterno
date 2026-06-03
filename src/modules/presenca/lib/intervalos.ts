// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 6 (#83) — wrappers tipados do CONTRATO de persistência do Tempo-na-demanda
// (ADR 0004). A forma de gravar/ler intervalos de atuação é importar estas funções
// do barrel — nunca chamar a RPC nem ler presenca.atuacao_intervalos direto.
//
// NOTA DE TIPAGEM (ADR 0004 / decisão #83): o schema `presenca` é tipado À MÃO aqui,
// de propósito. O gerador `supabase:gen-types` cobre só public/cliente/demanda;
// incluir `presenca` regeneraria todo o public a partir do remoto e ENTRELAÇARIA o
// types.ts com o trabalho concorrente do Torque CRM (working tree). Como o contrato
// já define a forma na fronteira do wrapper, tipamos local e mantemos types.ts
// intacto — zero footprint fora de presença. Os casts `as never`/`as ...` ficam
// confinados a este arquivo (a fronteira do módulo).

import { supabase } from "@/integrations/supabase/client";

/** Tempo acumulado de uma demanda, em segundos (o número honesto de "há quanto tempo"). */
export interface TempoDaDemanda {
  demandaId: string;
  segundos: number;
}

/**
 * Grava UM intervalo FECHADO de atuação numa demanda (contrato
 * `presenca.registrar_intervalo`). Chamado na borda atuando:true→false. A RPC
 * valida demanda existe + caller pode_ver_cliente (anti-órfão + autorização) e
 * escreve user_id = caller (anti-forja). Timestamps em ISO (epoch ms → Date).
 */
export async function registrarIntervalo(
  demandaId: string,
  inicioEpochMs: number,
  fimEpochMs: number,
): Promise<void> {
  const { error } = await supabase
    .schema("presenca" as never)
    .rpc("registrar_intervalo" as never, {
      p_demanda_id: demandaId,
      p_inicio: new Date(inicioEpochMs).toISOString(),
      p_fim: new Date(fimEpochMs).toISOString(),
    } as never);
  if (error) throw error;
}

/**
 * Tempo acumulado de TODAS as demandas de um cliente, numa só query (contrato
 * `presenca.tempo_por_demanda_do_cliente`). Audiência herdada: não-autorizado
 * recebe vazio (não erro). É o caminho de leitura da UI (evita N requests).
 */
export async function tempoPorDemandaDoCliente(
  clientId: string,
): Promise<TempoDaDemanda[]> {
  const { data, error } = await supabase
    .schema("presenca" as never)
    .rpc("tempo_por_demanda_do_cliente" as never, {
      p_client_id: clientId,
    } as never);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ demanda_id: string; segundos: number }>;
  return rows.map((r) => ({ demandaId: r.demanda_id, segundos: Number(r.segundos) }));
}

/**
 * Fecha um intervalo via `navigator.sendBeacon` — o ÚNICO transporte que sobrevive
 * ao unload da página (pagehide/visibilitychange→hidden). Sem ele, o último (e maior)
 * intervalo se perderia ao fechar a aba e o Tempo-na-demanda mentiria por baixo.
 *
 * Bate direto no endpoint REST da RPC (PostgREST) com o token atual — a própria RPC
 * revalida tudo (autorização, anti-órfão, user_id = caller), então o beacon é seguro.
 * Retorna true se o beacon foi enfileirado. Best-effort: nunca lança.
 */
export function beaconRegistrarIntervalo(
  demandaId: string,
  inicioEpochMs: number,
  fimEpochMs: number,
  acessoToken: string | null,
): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  if (!acessoToken || fimEpochMs <= inicioEpochMs) return false;

  // Reusa a config do client (sem reimportar env): a base url e a apikey já estão
  // embutidas no PostgREST client. Lemos do client para não duplicar config.
  // @ts-expect-error supabaseUrl/supabaseKey existem no client em runtime (não no tipo público).
  const baseUrl: string | undefined = supabase.supabaseUrl;
  // @ts-expect-error idem.
  const apiKey: string | undefined = supabase.supabaseKey;
  if (!baseUrl || !apiKey) return false;

  const url = `${baseUrl}/rest/v1/rpc/registrar_intervalo`;
  const body = JSON.stringify({
    p_demanda_id: demandaId,
    p_inicio: new Date(inicioEpochMs).toISOString(),
    p_fim: new Date(fimEpochMs).toISOString(),
  });

  // sendBeacon não permite headers custom; usa um Blob com content-type. O
  // PostgREST exige apikey + Authorization + Content-Profile=presenca. sendBeacon
  // não envia headers → caímos no fetch keepalive (sobrevive ao unload também) com
  // os headers necessários. keepalive é a forma correta com headers no unload.
  try {
    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "Content-Profile": "presenca",
        apikey: apiKey,
        Authorization: `Bearer ${acessoToken}`,
      },
      body,
    }).catch(() => {
      /* best-effort no unload */
    });
    return true;
  } catch {
    return false;
  }
}
