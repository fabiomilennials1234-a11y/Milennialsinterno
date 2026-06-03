// Barrel do módulo `demanda` — ÚNICO ponto público do módulo.
// Tudo que outros módulos / a aplicação podem usar é re-exportado aqui. Import de
// internals (`./lib/...`, `./components/...`) a partir de fora do módulo quebra o
// build (eslint-boundaries). Ver ADR 0004 e CONTEXT.md → "Módulo".

// Slice 4 (#80) — contrato de leitura/escrita do módulo (wrappers tipados).
export {
  listarDemandasDoCliente,
  criarDemanda,
  vincularCard,
} from "./lib/demandas";
export type { Demanda, DominioDemanda } from "./lib/demandas";

// Slice 4 (#80) — UI pública: painel "Demandas do cliente".
// Lista demandas do cliente (audiência herdada) + criar + vincular card.
// Quem monta a área do cliente importa SÓ isto — nada de hooks/lib cruzando o barrel.
export { DemandasDoCliente } from "./components/DemandasDoCliente";
