// Módulo `painel` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 8 (#84) — DECISÃO DE ESCALA da presença viva agregada.
//
// O problema: o board cross-cliente pode listar dezenas a centenas de clientes
// (um exec/admin vê TODOS). A presença viva (usePresencaDoCliente) abre UM canal
// Realtime private por cliente. Assinar todos no mount = dezenas/centenas de joins
// WebSocket simultâneos + um RLS check por canal → explode a 40→300 users (a
// tensão registrada no projeto). Polling global perderia o "ao vivo"; um único
// canal agregado exigiria reescrever o transporte do ADR 0007 (canal por cliente
// é a fronteira de audiência — um canal global furaria o isolamento LGPD).
//
// A escolha: LAZY-SUBSCRIBE POR VIEWPORT. Só os grupos de cliente VISÍVEIS na tela
// assinam seu canal; ao sair do viewport (com margem), desassinam. Isso LIMITA os
// canais concorrentes ao que cabe na tela (~5-15), INDEPENDENTE do total de
// clientes visíveis. Reusa o canal por cliente do ADR 0007 intacto (não fura
// audiência); só controla QUANDO assinar. Escala por construção: o custo é O(tela),
// não O(clientes).
//
// Este hook é a ponte: dado um `ativo` (vem do IntersectionObserver no card do
// grupo), monta usePresencaDoCliente só quando ativo. Quando inativo, devolve mapa
// vazio (a UI mostra o estado frio sem o "agora") — e o canal é removido pelo
// próprio cleanup de usePresencaDoCliente (clientId vira null).

import { usePresencaDoCliente, type MapaPresenca } from "@/modules/presenca";

/**
 * Presença viva de um cliente, assinada SÓ quando o grupo está no viewport.
 * `ativo=false` → não assina (mapa vazio); `ativo=true` → assina o canal do
 * cliente (1 WebSocket). Reusa usePresencaDoCliente passando clientId condicional:
 * null não assina (o hook trata null como "sem canal"), mantendo a fronteira de
 * audiência do ADR 0007 e a regra dos Hooks (sempre chamado, args mudam).
 */
export function usePresencaLazy(
  clientId: string,
  ativo: boolean,
): MapaPresenca {
  // clientId só "liga" o canal quando o grupo está visível. usePresencaDoCliente
  // trata null/undefined como "não assina" e limpa o canal anterior no cleanup.
  return usePresencaDoCliente(ativo ? clientId : null);
}
