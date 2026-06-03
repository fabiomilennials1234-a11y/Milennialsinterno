// Barrel do módulo `painel` — ÚNICO ponto público do módulo.
// Tudo que a aplicação / outros módulos podem usar é re-exportado aqui. Import de
// internals (`./lib/...`, `./components/...`) a partir de fora do módulo quebra o
// build (eslint-boundaries). Ver ADR 0004 e CONTEXT.md → "Módulo".
//
// Slice 8 (#84) — a vista de pássaro "Monday" agregada (capstone do PRD #75).
// Compõe os módulos `demanda` (contrato de agregação painel_do_usuario),
// `presenca` (presença viva por cliente, assinada LAZY por viewport) e o
// vocabulário visual mtech. Audiência herdada no banco (pode_ver_cliente, ADR 0005).

// UI pública: o board agregado. Quem monta a rota importa SÓ isto.
export { PainelDemandas } from "./components/PainelDemandas";

// Lógica pura (agrupamento/filtro) — exposta para reuso/teste fora do board, se
// preciso; a forma canônica de consumir é o componente acima.
export {
  agruparPorCliente,
  filtrarLinhas,
  opcoesDeFiltro,
} from "./lib/agrupar";
export type {
  LinhaPainel,
  GrupoCliente,
  FiltroPainel,
  OpcoesFiltro,
  OpcaoCliente,
} from "./lib/agrupar";
