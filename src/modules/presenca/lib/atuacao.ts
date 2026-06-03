// Módulo `presenca` — INTERNAL. Não importar de fora do módulo.
// Acesso público só via o barrel `src/modules/presenca/index.ts`.
//
// Slice 5 (#81) — LÓGICA PURA de atuação (ADR 0007). É o coração testável da
// Presença, mantido livre de React/Supabase/DOM (espelha computeTaskTime do
// Mtech): máquina de ociosidade, derivação de `atuando` e agregação do
// presence-state cru por demanda.
//
// Invariante de domínio (CONTEXT.md → Presença / Atuação): **online ≠ atuando**.
//   Presença  = a demanda está focada na UI agora (heartbeat, sem clique).
//   Atuação   = Presença MENOS ociosidade. Sem input (mouse/teclado) por um
//               limiar (~5 min) → auto-pausa. "O almoço com a aba aberta não conta."

/** Limiar de ociosidade padrão: 5 min. Configurável por estado (não é fixo). */
export const IDLE_LIMIAR_MS_PADRAO = 5 * 60 * 1_000;

/**
 * Estado da máquina de atuação de UM usuário numa UMA demanda. Imutável: as
 * funções abaixo retornam um novo estado, nunca mutam. `agora` é injetado
 * sempre (testável com fake timers; nenhuma leitura escondida de Date.now()).
 */
export interface EstadoAtuacao {
  /** epoch ms do último input (mouse/teclado) observado. */
  ultimoInputEm: number;
  /** a demanda está focada/visível na UI agora? (Presença) */
  focado: boolean;
  /** limiar de ociosidade em ms para ESTE estado. */
  idleLimiarMs: number;
}

/** Cria o estado inicial. `focado` começa false — o caller liga ao focar. */
export function criarEstadoAtuacao(
  ultimoInputEm: number,
  idleLimiarMs: number = IDLE_LIMIAR_MS_PADRAO,
): EstadoAtuacao {
  return { ultimoInputEm, focado: false, idleLimiarMs };
}

/** Registra um input em `agora` — reseta o relógio de ociosidade. Puro. */
export function registrarInput(estado: EstadoAtuacao, agora: number): EstadoAtuacao {
  return { ...estado, ultimoInputEm: agora };
}

/**
 * Está ocioso em `agora`? Vira idle EXATAMENTE no limiar (>=), por isso um
 * usuário que abriu e largou a aba auto-pausa de forma determinística.
 */
export function estaIdle(estado: EstadoAtuacao, agora: number): boolean {
  return agora - estado.ultimoInputEm >= estado.idleLimiarMs;
}

/**
 * `atuando` = focado ∧ ¬idle. É a derivação canônica de Atuação a partir de
 * Presença (focado) menos ociosidade. online (focado) ≠ atuando.
 */
export function derivarAtuando(estado: EstadoAtuacao, agora: number): boolean {
  return estado.focado && !estaIdle(estado, agora);
}

// ============================================================================
// Agregação do presence-state cru → mapa por demanda (para o badge ao vivo).
// ============================================================================

/** Uma entrada crua do presence-state do canal (o payload do track()). */
export interface PresencaCrua {
  user_id: string;
  /** demanda focada agora; null = no canal mas sem demanda em foco. */
  demanda_id: string | null;
  atuando: boolean;
}

/** Quem está numa demanda, já deduplicado por usuário. */
export interface PresencaNaDemanda {
  user_id: string;
  atuando: boolean;
}

export type MapaPresenca = Record<string, PresencaNaDemanda[]>;

/**
 * Agrega o presence-state cru em `{ demandaId -> [{user_id, atuando}] }`.
 * - Ignora entradas sem `demanda_id` (usuário no canal sem demanda focada).
 * - Deduplica o mesmo usuário na mesma demanda (multi-aba/socket): se QUALQUER
 *   sessão da pessoa está atuando, ela conta como atuando (OR — "última vence"
 *   no sentido de prevalecer o estado ativo).
 */
export function agregarPorDemanda(estado: PresencaCrua[]): MapaPresenca {
  const porDemanda = new Map<string, Map<string, boolean>>();

  for (const p of estado) {
    if (!p.demanda_id) continue;
    let usuarios = porDemanda.get(p.demanda_id);
    if (!usuarios) {
      usuarios = new Map<string, boolean>();
      porDemanda.set(p.demanda_id, usuarios);
    }
    const anterior = usuarios.get(p.user_id) ?? false;
    usuarios.set(p.user_id, anterior || p.atuando);
  }

  const out: MapaPresenca = {};
  for (const [demandaId, usuarios] of porDemanda) {
    out[demandaId] = Array.from(usuarios, ([user_id, atuando]) => ({ user_id, atuando }));
  }
  return out;
}
