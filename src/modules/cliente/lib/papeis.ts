// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 2 (#78) — vocabulário de apresentação dos papéis de Envolvido.
// Fonte única do rótulo humano + tom de cor de cada `papel_no_cliente`.
// A semântica canônica dos papéis vive no contrato (`envolvidos.ts` / ADR 0005);
// aqui é só a camada de UI (como o papel se chama e se pinta na tela).

import type { PapelNoCliente } from "./envolvidos";

/** Rótulo humano de cada papel (pt-BR, capitalização editorial). */
export const PAPEL_LABEL: Record<PapelNoCliente, string> = {
  ads_manager: "Gestor de Ads",
  comercial: "Comercial",
  crm: "CRM",
  rh: "RH",
  outbound_manager: "Outbound",
  sucesso_cliente: "Sucesso do Cliente",
  mktplace: "Marketplace",
  secondary_manager: "Gestor Secundário",
};

/**
 * Tom de cor de cada papel — classes Tailwind sobre tokens do design system.
 * Acentos saturados com parcimônia (princípio dark-first): cada chip carrega
 * uma cor de borda/texto sutil para diferenciar a área sem competir com o nome
 * da pessoa, que é o dado primário. Tudo em opacidade baixa de fundo + texto
 * legível no dark (#09090B base).
 */
export const PAPEL_TONE: Record<PapelNoCliente, string> = {
  ads_manager: "border-info/30 bg-info/10 text-info",
  comercial: "border-success/30 bg-success/10 text-success",
  crm: "border-purple/30 bg-purple/10 text-purple",
  rh: "border-warning/30 bg-warning/10 text-warning",
  outbound_manager: "border-section-orange/30 bg-section-orange/10 text-section-orange",
  sucesso_cliente: "border-primary/30 bg-primary/10 text-primary",
  mktplace: "border-info/30 bg-info/10 text-info",
  secondary_manager: "border-border-strong bg-muted/40 text-muted-foreground",
};

/** Ordem canônica de exibição dos papéis no seletor e nos chips. */
export const PAPEL_ORDER: PapelNoCliente[] = [
  "ads_manager",
  "sucesso_cliente",
  "comercial",
  "crm",
  "mktplace",
  "outbound_manager",
  "secondary_manager",
  "rh",
];

/** Iniciais para o fallback de avatar (1–2 letras, maiúsculas). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}
