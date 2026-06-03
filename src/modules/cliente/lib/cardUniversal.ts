// Módulo `cliente` — INTERNAL. Não importar de fora do módulo.
// Acesso público só via o barrel `src/modules/cliente/index.ts`.
//
// Slice 1 (#77) — wrapper tipado do contrato de LEITURA do Card Universal.
// Em outros módulos/telas, a forma de ler o card consolidado de um cliente é
// importar `lerCardUniversal` (ou o hook) do barrel — nunca chamar a RPC nem
// ler public.client_info_bank direto. Ver ADR 0004 (contrato-only) e ADR 0005.
//
// O contrato `cliente.card_universal` retorna 0 ou 1 linha (RETURNS TABLE → array
// no PostgREST). 0 linhas = caller não pode ver o cliente (gate de audiência) OU
// o cliente não tem info_bank ainda → para a UI ambos são "sem card" (null).
import { supabase } from "@/integrations/supabase/client";

/**
 * Card Universal de Cliente — visão consolidada read-mostly de fonte única
 * (`public.client_info_bank`). Campos agrupados por seção do domínio.
 * Espelha o RETURNS TABLE de `cliente.card_universal`.
 */
export interface CardUniversal {
  client_id: string;
  // Marca
  brand_colors: string | null;
  typography: string | null;
  visual_style: string | null;
  brand_manual_url: string | null;
  logo_url: string | null;
  // Presença Digital
  website_url: string | null;
  instagram_handle: string | null;
  youtube_channel: string | null;
  tiktok_handle: string | null;
  domain: string | null;
  // Vídeo
  editing_style: string | null;
  video_formats: string | null;
  // Dev
  cms_platform: string | null;
  figma_url: string | null;
  // Geral
  notes: string | null;
  // Auditoria
  updated_at: string;
  updated_by: string;
}

/**
 * Lê o Card Universal de um cliente (contrato `cliente.card_universal`).
 * Retorna `null` se o caller não pode ver o cliente (gate de audiência) ou se
 * ainda não há card — a UI trata ambos como "sem dados". Só admin/envolvido/
 * page-grant recebe a linha (gate dentro da RPC; ver ADR 0005).
 */
export async function lerCardUniversal(clientId: string): Promise<CardUniversal | null> {
  const { data, error } = await supabase
    .schema("cliente")
    .rpc("card_universal", { p_client_id: clientId });
  if (error) throw error;
  const linha = (data ?? [])[0];
  return (linha as CardUniversal | undefined) ?? null;
}
