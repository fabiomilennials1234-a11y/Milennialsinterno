// Barrel do módulo `cliente` — ÚNICO ponto público do módulo.
// Tudo que outros módulos podem usar é re-exportado aqui. Import de internals
// (`./lib/...`) a partir de fora do módulo quebra o build (eslint-boundaries).
// Ver ADR 0004 e CONTEXT.md → "Módulo".
export { clienteExiste } from "./lib/existe";
export {
  listarEnvolvidos,
  adicionarEnvolvido,
  removerEnvolvido,
} from "./lib/envolvidos";
export type { Envolvido, PapelNoCliente } from "./lib/envolvidos";

// Slice 2 (#78) — UI pública do módulo: painel "Equipe do cliente".
// O componente encapsula a interface mínima de Envolvido (listar/adicionar/remover)
// + a resolução de identidade para a tela. Quem monta a área do cliente importa
// SÓ isto — nada de hooks/lib internos cruzando o barrel.
export { EquipeDoCliente } from "./components/EquipeDoCliente";

// Slice 1 (#77) — Card Universal de Cliente (LEITURA).
// Contrato de leitura consolidada (`cliente.card_universal`) + painel read-only.
// Audiência = Envolvidos/exec/page-grant (gate na RPC + RLS; ADR 0005).
export { lerCardUniversal } from "./lib/cardUniversal";
export type { CardUniversal } from "./lib/cardUniversal";
export { useCardUniversal } from "./lib/useCardUniversal";
export { CardUniversalCliente } from "./components/CardUniversalCliente";
