// Módulo `painel` — INTERNAL. Não importar de fora do módulo.
// Acesso público só via o barrel `src/modules/painel/index.ts`.
//
// Slice 8 (#84) — LÓGICA PURA do board "Monday" agregado. Transforma as linhas
// planas da RPC `demanda.painel_do_usuario()` (uma por demanda, já escopadas por
// audiência NO BANCO) em estrutura agrupada por cliente, com filtros e ordenação.
// Mantida livre de React/Supabase/DOM — é o coração testável do board.
//
// Invariante: a audiência (quem vê o quê) é decidida no BANCO (pode_ver_cliente,
// ADR 0005). Esta camada NÃO filtra por permissão — só organiza o que já chegou.
// Filtrar permissão no client duplicaria a fonte da verdade.

/** Uma linha do contrato `demanda.painel_do_usuario` (espelha o RETURNS TABLE). */
export interface LinhaPainel {
  demanda_id: string;
  client_id: string;
  client_nome: string;
  titulo: string;
  status: string;
  dominio: string | null;
  created_at: string;
  /** Tempo-na-demanda acumulado, em segundos (soma dos intervalos). */
  tempo_segundos: number;
}

/** Um grupo de demandas de um mesmo cliente (a coluna/seção do board). */
export interface GrupoCliente {
  clientId: string;
  clientNome: string;
  demandas: LinhaPainel[];
  totalDemandas: number;
  /** Soma do Tempo-na-demanda de todas as demandas do grupo (cabeçalho do grupo). */
  tempoTotalSegundos: number;
}

/** Critérios de filtro do board. Tudo opcional; ausência = não filtra. */
export interface FiltroPainel {
  /** Busca textual (título da demanda OU nome do cliente), case-insensitive. */
  busca?: string;
  status?: string;
  dominio?: string;
  clientId?: string;
}

/**
 * Agrupa linhas planas por cliente, preservando a ordem de chegada das demandas
 * dentro do grupo (a RPC já ordena por created_at DESC). Grupos saem ordenados
 * por nome do cliente (A→Z) — estável e previsível para o olho do gestor.
 */
export function agruparPorCliente(linhas: LinhaPainel[]): GrupoCliente[] {
  const mapa = new Map<string, GrupoCliente>();

  for (const l of linhas) {
    let g = mapa.get(l.client_id);
    if (!g) {
      g = {
        clientId: l.client_id,
        clientNome: l.client_nome,
        demandas: [],
        totalDemandas: 0,
        tempoTotalSegundos: 0,
      };
      mapa.set(l.client_id, g);
    }
    g.demandas.push(l);
    g.totalDemandas += 1;
    g.tempoTotalSegundos += Number.isFinite(l.tempo_segundos) ? l.tempo_segundos : 0;
  }

  return Array.from(mapa.values()).sort((a, b) =>
    a.clientNome.localeCompare(b.clientNome, "pt-BR"),
  );
}

/**
 * Aplica os filtros do board às linhas (AND entre critérios). Busca textual casa
 * título da demanda OU nome do cliente; status/domínio/cliente são igualdade exata.
 * Preserva a ordem de entrada.
 */
export function filtrarLinhas(linhas: LinhaPainel[], filtro: FiltroPainel): LinhaPainel[] {
  const termo = filtro.busca?.trim().toLowerCase() ?? "";

  return linhas.filter((l) => {
    if (termo) {
      const casaBusca =
        l.titulo.toLowerCase().includes(termo) ||
        l.client_nome.toLowerCase().includes(termo);
      if (!casaBusca) return false;
    }
    if (filtro.status && l.status !== filtro.status) return false;
    if (filtro.dominio && l.dominio !== filtro.dominio) return false;
    if (filtro.clientId && l.client_id !== filtro.clientId) return false;
    return true;
  });
}

/** Cliente como opção de seletor (id + nome). */
export interface OpcaoCliente {
  clientId: string;
  clientNome: string;
}

/** Conjuntos distintos para os seletores de filtro do board. */
export interface OpcoesFiltro {
  status: string[];
  dominios: string[];
  clientes: OpcaoCliente[];
}

/**
 * Extrai os valores distintos presentes nas linhas para alimentar os seletores
 * de filtro — status e domínios ordenados alfabeticamente, clientes por nome.
 * Domínio nulo é ignorado (não vira opção "vazia").
 */
export function opcoesDeFiltro(linhas: LinhaPainel[]): OpcoesFiltro {
  const status = new Set<string>();
  const dominios = new Set<string>();
  const clientes = new Map<string, string>();

  for (const l of linhas) {
    if (l.status) status.add(l.status);
    if (l.dominio) dominios.add(l.dominio);
    clientes.set(l.client_id, l.client_nome);
  }

  return {
    status: Array.from(status).sort((a, b) => a.localeCompare(b, "pt-BR")),
    dominios: Array.from(dominios).sort((a, b) => a.localeCompare(b, "pt-BR")),
    clientes: Array.from(clientes, ([clientId, clientNome]) => ({ clientId, clientNome })).sort(
      (a, b) => a.clientNome.localeCompare(b.clientNome, "pt-BR"),
    ),
  };
}
