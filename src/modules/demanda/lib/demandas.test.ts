import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase client mock ──
// Registra .schema('demanda').rpc(name, args) e devolve um resultado controlado.
// O teste verifica o COMPORTAMENTO da interface pública dos wrappers do contrato,
// não a implementação. `vi.hoisted` porque `vi.mock` é içado acima das const.
const { rpc, schema } = vi.hoisted(() => {
  const rpc = vi.fn();
  const schema = vi.fn(() => ({ rpc }));
  return { rpc, schema };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { schema },
}));

import {
  listarDemandasDoCliente,
  criarDemanda,
  vincularCard,
} from "./demandas";

beforeEach(() => {
  rpc.mockReset();
  schema.mockClear();
});

const CLIENT = "11111111-1111-1111-1111-111111111111";
const DEMANDA = "22222222-2222-2222-2222-222222222222";
const CARD = "33333333-3333-3333-3333-333333333333";

describe("listarDemandasDoCliente", () => {
  it("chama o contrato demanda.do_cliente via schema('demanda').rpc", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listarDemandasDoCliente(CLIENT);
    expect(schema).toHaveBeenCalledWith("demanda");
    expect(rpc).toHaveBeenCalledWith("do_cliente", { p_client_id: CLIENT });
  });

  it("retorna as demandas quando há linhas", async () => {
    const rows = [
      { id: DEMANDA, client_id: CLIENT, titulo: "Landing", status: "aberta", dominio: "design", created_at: "2026-06-03T00:00:00Z" },
    ];
    rpc.mockResolvedValue({ data: rows, error: null });
    await expect(listarDemandasDoCliente(CLIENT)).resolves.toEqual(rows);
  });

  it("retorna [] quando o contrato devolve vazio (audiência: 200+vazio, não erro)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(listarDemandasDoCliente(CLIENT)).resolves.toEqual([]);
  });

  it("lança quando a RPC devolve erro (contrato não engole falha)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(listarDemandasDoCliente(CLIENT)).rejects.toThrow("boom");
  });
});

describe("criarDemanda", () => {
  it("chama o contrato demanda.criar com titulo e dominio", async () => {
    rpc.mockResolvedValue({ data: DEMANDA, error: null });
    await criarDemanda(CLIENT, "Landing", "design");
    expect(schema).toHaveBeenCalledWith("demanda");
    expect(rpc).toHaveBeenCalledWith("criar", {
      p_client_id: CLIENT,
      p_titulo: "Landing",
      p_dominio: "design",
    });
  });

  it("passa p_dominio null quando dominio é omitido", async () => {
    rpc.mockResolvedValue({ data: DEMANDA, error: null });
    await criarDemanda(CLIENT, "Sem dominio");
    expect(rpc).toHaveBeenCalledWith("criar", {
      p_client_id: CLIENT,
      p_titulo: "Sem dominio",
      p_dominio: null,
    });
  });

  it("retorna o id da demanda criada", async () => {
    rpc.mockResolvedValue({ data: DEMANDA, error: null });
    await expect(criarDemanda(CLIENT, "Landing")).resolves.toBe(DEMANDA);
  });

  it("lança quando a RPC devolve erro (ex.: anti-órfão / autorização)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("permission denied") });
    await expect(criarDemanda(CLIENT, "Landing")).rejects.toThrow("permission denied");
  });
});

describe("vincularCard", () => {
  it("chama o contrato demanda.vincular_card com demanda_id e card_ref", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await vincularCard(DEMANDA, CARD);
    expect(schema).toHaveBeenCalledWith("demanda");
    expect(rpc).toHaveBeenCalledWith("vincular_card", {
      p_demanda_id: DEMANDA,
      p_card_ref: CARD,
    });
  });

  it("lança quando a RPC devolve erro (ex.: anti-órfão do card/demanda)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("card não existe") });
    await expect(vincularCard(DEMANDA, CARD)).rejects.toThrow("card não existe");
  });
});
