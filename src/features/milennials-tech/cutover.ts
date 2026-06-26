// Ponto unico de flip do cutover "Kanban Desenvolvimento -> Milennials Tech"
// (slice #167). Enquanto false, NADA muda: o board devs segue operacional.
//
// Ao cortar (decisao do fundador, em janela de manutencao), virar para `true`:
//   - DevsKanbanBoard renderiza o aviso read-only (deixa de operar o board).
//   - A nav do board deve consumir esta MESMA const para sumir o item
//     (ver scripts/migration/devs_cutover_revoke_dml.sql -> secao "NAV").
//
// O flip de UI e cosmetico/UX. A AUTORIDADE do corte e no DB (RLS), aplicada
// LIVE em 2026-06-26 (slice #167): policies RESTRICTIVE devs_board_readonly_*
// em public.kanban_cards + migracao de 24 demandas abertas -> Project KDEV.
// Virado para `true` apos o corte de DB; efeito de UI no proximo deploy.
export const KANBAN_DEV_CUTOVER = true;

export const KANBAN_DEV_CUTOVER_NOTICE = {
  title: 'Kanban Desenvolvimento migrou para o Milennials Tech',
  body: 'As demandas de desenvolvimento agora vivem no mtech (Projects, Epics, Issues). Este quadro ficou somente leitura.',
  ctaLabel: 'Abrir Milennials Tech',
  ctaHref: '/milennials-tech',
} as const;
