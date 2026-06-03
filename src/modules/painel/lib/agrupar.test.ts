// Módulo `painel` — testes da LÓGICA PURA de agrupamento/filtro. Slice 8 (#84).
//
// O board "Monday" recebe linhas planas da RPC `demanda.painel_do_usuario()`
// (uma linha por demanda, já escopada por audiência no banco) e precisa: agrupar
// por cliente, aplicar filtros (busca textual, status, domínio) e ordenar de forma
// estável. Tudo aqui é PURO — sem React, sem Supabase, sem DOM — testável direto.
//
// Invariante: a audiência (quem vê o quê) é decidida no BANCO (pode_ver_cliente);
// esta camada NÃO filtra por permissão — só organiza o que já chegou. Filtrar
// permissão no client seria duplicar a fonte da verdade (anti-ADR 0005).

import { describe, it, expect } from "vitest";
import {
  agruparPorCliente,
  filtrarLinhas,
  opcoesDeFiltro,
  type LinhaPainel,
} from "./agrupar";

const LINHAS: LinhaPainel[] = [
  { demanda_id: "d1", client_id: "ca", client_nome: "Cliente A", titulo: "Landing", status: "aberta", dominio: "design", created_at: "2026-06-01T10:00:00Z", tempo_segundos: 600 },
  { demanda_id: "d2", client_id: "ca", client_nome: "Cliente A", titulo: "Campanha", status: "concluída", dominio: "ads", created_at: "2026-06-02T10:00:00Z", tempo_segundos: 0 },
  { demanda_id: "d3", client_id: "cb", client_nome: "Cliente B", titulo: "App", status: "aberta", dominio: "dev", created_at: "2026-06-03T10:00:00Z", tempo_segundos: 120 },
];

describe("agruparPorCliente", () => {
  it("agrupa linhas em um grupo por cliente distinto", () => {
    const grupos = agruparPorCliente(LINHAS);
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.clientId)).toEqual(["ca", "cb"]);
  });

  it("preserva nome do cliente e coleta as demandas do grupo", () => {
    const grupos = agruparPorCliente(LINHAS);
    const a = grupos.find((g) => g.clientId === "ca")!;
    expect(a.clientNome).toBe("Cliente A");
    expect(a.demandas.map((d) => d.demanda_id)).toEqual(["d1", "d2"]);
  });

  it("ordena grupos por nome do cliente (estável, A→Z)", () => {
    // Entrada fora de ordem deve sair ordenada por nome.
    const fora = [LINHAS[2], LINHAS[0], LINHAS[1]];
    const grupos = agruparPorCliente(fora);
    expect(grupos.map((g) => g.clientNome)).toEqual(["Cliente A", "Cliente B"]);
  });

  it("expõe contagem de demandas e tempo total do grupo (cabeçalho)", () => {
    const grupos = agruparPorCliente(LINHAS);
    const a = grupos.find((g) => g.clientId === "ca")!;
    expect(a.totalDemandas).toBe(2);
    expect(a.tempoTotalSegundos).toBe(600); // 600 + 0
  });

  it("não cria grupo para entrada vazia", () => {
    expect(agruparPorCliente([])).toEqual([]);
  });
});

describe("filtrarLinhas", () => {
  it("sem filtros, devolve tudo", () => {
    expect(filtrarLinhas(LINHAS, {})).toHaveLength(3);
  });

  it("filtra por busca textual no título (case-insensitive)", () => {
    const out = filtrarLinhas(LINHAS, { busca: "land" });
    expect(out.map((l) => l.demanda_id)).toEqual(["d1"]);
  });

  it("busca textual também casa o nome do cliente", () => {
    const out = filtrarLinhas(LINHAS, { busca: "cliente b" });
    expect(out.map((l) => l.demanda_id)).toEqual(["d3"]);
  });

  it("filtra por status exato", () => {
    const out = filtrarLinhas(LINHAS, { status: "aberta" });
    expect(out.map((l) => l.demanda_id)).toEqual(["d1", "d3"]);
  });

  it("filtra por domínio exato", () => {
    const out = filtrarLinhas(LINHAS, { dominio: "ads" });
    expect(out.map((l) => l.demanda_id)).toEqual(["d2"]);
  });

  it("filtra por cliente específico", () => {
    const out = filtrarLinhas(LINHAS, { clientId: "cb" });
    expect(out.map((l) => l.demanda_id)).toEqual(["d3"]);
  });

  it("combina filtros (AND): status + domínio", () => {
    const out = filtrarLinhas(LINHAS, { status: "aberta", dominio: "design" });
    expect(out.map((l) => l.demanda_id)).toEqual(["d1"]);
  });

  it("filtro que não casa nada devolve vazio (não erro)", () => {
    expect(filtrarLinhas(LINHAS, { busca: "zzz" })).toEqual([]);
  });

  it("ignora espaços em branco na busca", () => {
    expect(filtrarLinhas(LINHAS, { busca: "   " })).toHaveLength(3);
  });
});

describe("opcoesDeFiltro", () => {
  it("extrai status e domínios distintos, ordenados, para os seletores", () => {
    const o = opcoesDeFiltro(LINHAS);
    expect(o.status).toEqual(["aberta", "concluída"]);
    expect(o.dominios).toEqual(["ads", "design", "dev"]);
  });

  it("extrai clientes distintos (id+nome) ordenados por nome", () => {
    const o = opcoesDeFiltro(LINHAS);
    expect(o.clientes).toEqual([
      { clientId: "ca", clientNome: "Cliente A" },
      { clientId: "cb", clientNome: "Cliente B" },
    ]);
  });

  it("ignora domínio nulo nas opções", () => {
    const comNulo: LinhaPainel[] = [
      { ...LINHAS[0], dominio: null },
      LINHAS[2],
    ];
    expect(opcoesDeFiltro(comNulo).dominios).toEqual(["dev"]);
  });

  it("entrada vazia devolve opções vazias", () => {
    expect(opcoesDeFiltro([])).toEqual({ status: [], dominios: [], clientes: [] });
  });
});
