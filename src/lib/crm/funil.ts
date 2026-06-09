// src/lib/crm/funil.ts
//
// ADR 0010 — Funil A/B: dois presets fixos do pipeline de qualificação de lead do
// CRM, mutuamente exclusivos por cliente. As etapas são CONSTANTES em código (não
// config): mudar exige deploy — trade-off consciente por padronização total.
//
// Dono da escolha: Gestor de ADS, no modal de gerar tarefa do CRM. Storage:
// clients.funil ('A'|'B', nullable até a primeira geração). Demais superfícies só
// LEEM (badge read-only).

export type Funil = 'A' | 'B';

/** Funil A (14 etapas) — jornada com ramo de automação / qualificação quente. */
export const FUNIL_A: readonly string[] = [
  'Novo Lead',
  'Pré Qualificar',
  'Ligação Whatsapp',
  'Automação',
  'Respondeu Disparo',
  'Qualificando',
  'Qualificado Quente',
  'Ligação Marcada',
  'Apresentação Marcada',
  'Proposta Enviada',
  'Nutrição Infinita',
  'Futuro',
  'Sem Resposta',
  'Perdido',
] as const;

/** Funil B (15 etapas) — jornada com cadência manual + coleta + criação de proposta. */
export const FUNIL_B: readonly string[] = [
  'Novo Lead',
  'Pré Qualificar',
  'Ligação Whatsapp',
  'Cadência',
  'Respondeu Disparo',
  'Coletando Informações',
  'Ligação Marcada',
  'Criando Proposta',
  'Apresentação Marcada',
  'Proposta Enviada',
  'Nutrição Infinita',
  'Futuro',
  'Sem Resposta',
  'Perdido',
  'Agendado',
] as const;

/** Etapas do funil dado o preset. Fonte única consumida pelo modal e pelo badge. */
export const FUNIL_ETAPAS: Record<Funil, readonly string[]> = {
  A: FUNIL_A,
  B: FUNIL_B,
};

export const FUNIL_LABEL: Record<Funil, string> = {
  A: 'Funil A',
  B: 'Funil B',
};

/** Lista ordenada dos presets — para iterar opções na UI sem hardcode. */
export const FUNIL_VALUES: readonly Funil[] = ['A', 'B'] as const;

/** Type guard — valida string crua (ex.: vinda do DB) como Funil. */
export function isFunil(v: unknown): v is Funil {
  return v === 'A' || v === 'B';
}

/** Etapas do funil, tolerante a entrada nula/inválida (devolve [] em vez de quebrar). */
export function etapasDoFunil(funil: string | null | undefined): readonly string[] {
  return isFunil(funil) ? FUNIL_ETAPAS[funil] : [];
}
