// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 6 (#83) — LÓGICA PURA do intervalo de atuação (ADR 0007 / CONTEXT.md →
// Tempo-na-demanda). É o "quando fechar o intervalo" — decidido aqui, não no hook.
// Mantida livre de React/Supabase/DOM (espelha a disciplina de `atuacao.ts`).
//
// Regra do domínio: persiste-se SÓ o intervalo FECHADO, na borda atuando:true→false
// (pausa/idle/blur/troca/fechar-aba) — NÃO por heartbeat. Por isso a transição só
// EMITE um intervalo quando `atuando` cai de true para false; um heartbeat com
// `atuando` inalterado nunca emite (sem duplicar). A janela ociosa fica FORA de
// qualquer intervalo (idle não conta). Intervalos do mesmo usuário/demanda são
// disjuntos por construção (abre na subida, fecha na descida) → a soma é honesta.

/** Um intervalo FECHADO de atuação, em epoch ms. Duração = fim - inicio (> 0). */
export interface IntervaloFechado {
  inicio: number;
  fim: number;
}

/** Estado do rastreador: o instante (epoch ms) em que o intervalo atual abriu, ou null. */
export interface RastreadorIntervalo {
  /** epoch ms em que `atuando` subiu para true; null = nenhum intervalo aberto. */
  abertoEm: number | null;
}

/** Resultado de uma transição: o novo estado + o intervalo emitido (se fechou agora). */
export interface ResultadoIntervalo {
  estado: RastreadorIntervalo;
  /** intervalo fechado nesta transição, ou null se nada fechou. */
  fechado: IntervaloFechado | null;
}

/** Estado inicial: nenhum intervalo aberto. */
export function intervaloVazio(): RastreadorIntervalo {
  return { abertoEm: null };
}

/**
 * Transiciona o rastreador ao observar `atuandoAgora` em `agora` (epoch ms). Puro.
 * - false→true (abre): guarda `abertoEm = agora`; não emite.
 * - true→true (heartbeat): mantém o mesmo `abertoEm`; não emite (sem duplicar).
 * - true→false (fecha): emite { inicio: abertoEm, fim: agora }; zera `abertoEm`.
 *   Defensivo: se a duração for não-positiva (relógio/borda degenerada), não emite.
 * - false→false: no-op.
 */
export function transicionarIntervalo(
  estado: RastreadorIntervalo,
  atuandoAgora: boolean,
  agora: number,
): ResultadoIntervalo {
  const aberto = estado.abertoEm !== null;

  if (atuandoAgora) {
    // Abre se ainda não havia intervalo aberto; senão mantém (heartbeat).
    return aberto
      ? { estado, fechado: null }
      : { estado: { abertoEm: agora }, fechado: null };
  }

  // atuandoAgora === false
  if (!aberto) return { estado, fechado: null };

  const inicio = estado.abertoEm as number;
  if (agora > inicio) {
    return { estado: { abertoEm: null }, fechado: { inicio, fim: agora } };
  }
  // Borda degenerada (agora <= inicio): fecha sem emitir intervalo inválido.
  return { estado: { abertoEm: null }, fechado: null };
}

/**
 * Fecha o intervalo aberto em `agora` (fechar-aba/unmount/troca de demanda) — não
 * perde o último (e maior) intervalo. Idempotente: sem intervalo aberto, é no-op
 * (não emite, não duplica). Defensivo: duração não-positiva não emite.
 */
export function flushIntervalo(
  estado: RastreadorIntervalo,
  agora: number,
): ResultadoIntervalo {
  if (estado.abertoEm === null) return { estado, fechado: null };
  const inicio = estado.abertoEm;
  if (agora > inicio) {
    return { estado: { abertoEm: null }, fechado: { inicio, fim: agora } };
  }
  return { estado: { abertoEm: null }, fechado: null };
}
