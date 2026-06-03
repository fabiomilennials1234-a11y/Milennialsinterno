// Módulo `cliente` — INTERNAL. Não importar de fora do módulo.
// Acesso público só via o barrel `src/modules/cliente/index.ts`.
//
// Slice 3 (#79) — wrapper tipado do contrato de ESCRITA do Card Universal.
// Em outros módulos/telas, a forma de EDITAR o card consolidado de um cliente é
// importar `editarCardUniversal` (ou o hook) do barrel — nunca chamar a RPC nem
// escrever public.client_info_bank direto (a escrita direta está revogada na
// Slice 3). Ver ADR 0004 (contrato-only) e ADR 0005.
//
// O contrato `cliente.editar_card_universal` é SECURITY DEFINER e aplica o gate
// de autorização (cliente.pode_ver_cliente → 42501) + existência (cliente.existe
// → P0002). NULL/ausente = "não mexer" (UPSERT idempotente via COALESCE no DB).
//
// Type-safety: hand-typed (NÃO regenerar types.ts — o schema cliente é tipado à
// mão neste módulo, ver cardUniversal.ts). A forma editável espelha as colunas de
// domínio do card; auditoria (updated_at/by) é responsabilidade do servidor.
import { supabase } from "@/integrations/supabase/client";
import type { CardUniversal } from "./cardUniversal";

/**
 * Campos editáveis do Card Universal — subconjunto de domínio de `CardUniversal`
 * (exclui `client_id` e a auditoria, que o servidor controla). Todos opcionais:
 * passar só o que muda; ausente/`null` preserva o valor atual (COALESCE no DB).
 */
export type EdicaoCardUniversal = Partial<
  Omit<CardUniversal, "client_id" | "updated_at" | "updated_by">
>;

/**
 * Mapeia a forma de domínio (camelo do card) para os parâmetros `p_*` da RPC.
 * Só inclui chaves presentes no patch — ausência = não mexer (COALESCE).
 */
function paraParametrosRpc(
  clientId: string,
  patch: EdicaoCardUniversal,
): Record<string, string | null> {
  const params: Record<string, string | null> = { p_client_id: clientId };
  const campos: (keyof EdicaoCardUniversal)[] = [
    "brand_colors",
    "typography",
    "visual_style",
    "brand_manual_url",
    "logo_url",
    "website_url",
    "instagram_handle",
    "youtube_channel",
    "tiktok_handle",
    "domain",
    "editing_style",
    "video_formats",
    "cms_platform",
    "figma_url",
    "notes",
  ];
  for (const campo of campos) {
    if (campo in patch) {
      params[`p_${campo}`] = patch[campo] ?? null;
    }
  }
  return params;
}

/**
 * Edita (UPSERT) o Card Universal de um cliente via contrato
 * `cliente.editar_card_universal`. Retorna o `id` da linha do banco de info.
 *
 * Erros propagados (o contrato não engole falha):
 * - `42501` (insufficient_privilege) — caller não pode ver/editar o cliente;
 * - `P0002` (no_data_found) — cliente inexistente (caller autorizado/admin).
 *
 * @param clientId uuid do cliente
 * @param patch    campos a alterar; ausência preserva o valor atual
 */
export async function editarCardUniversal(
  clientId: string,
  patch: EdicaoCardUniversal,
): Promise<string> {
  const { data, error } = await supabase
    .schema("cliente")
    .rpc("editar_card_universal", paraParametrosRpc(clientId, patch));
  if (error) throw error;
  return data as string;
}
