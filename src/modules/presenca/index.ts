// Barrel do módulo `presenca` — ÚNICO ponto público do módulo.
// Tudo que a aplicação / outros módulos podem usar é re-exportado aqui. Import de
// internals (`./lib/...`, `./components/...`) a partir de fora do módulo quebra o
// build (eslint-boundaries). Ver ADR 0004, ADR 0007 e CONTEXT.md → "Presença".
//
// Slice 5 (#81) — Presença ao vivo. Estado VIVO e efêmero (Supabase Realtime
// Presence, canal private por cliente — NÃO toca o banco). NÃO persiste tempo
// (isso é #83). online ≠ atuando: atuação é presença menos ociosidade.

// Anúncio: ao focar uma demanda, entra no canal e faz track({user,demanda,atuando}).
export { usePresencaDemanda } from "./lib/usePresencaDemanda";
export type { UsePresencaDemandaArgs } from "./lib/usePresencaDemanda";

// Observação (read-only): mapa { demandaId -> [{user_id, atuando}] } para o badge.
export { usePresencaDoCliente } from "./lib/usePresencaDoCliente";

// UI pública: badge "fulano atuando agora" ao vivo numa demanda.
export { BadgeAtuando } from "./components/BadgeAtuando";

// Tipos do domínio de presença (a forma agregada consumida pela UI).
export type {
  MapaPresenca,
  PresencaNaDemanda,
  PresencaCrua,
} from "./lib/atuacao";

// Slice 6 (#83) — Tempo-na-demanda PERSISTIDO. Soma dos intervalos de atuação
// (o "há quanto tempo" honesto). Leitura por cliente (uma query) + formatador.
// A escrita (registrar_intervalo) é interna ao usePresencaDemanda — não pública.
export { useTempoNaDemanda, formatarTempo } from "./lib/useTempoNaDemanda";
