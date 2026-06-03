import { describe, it, expect, vi, beforeEach } from "vitest";

// Mesmo padrão do existe.test.ts: registra a chamada
// .schema('cliente').rpc(name, args) e verifica o COMPORTAMENTO da interface
// pública (os wrappers do contrato), não a implementação.
const { rpc, schema } = vi.hoisted(() => {
  const rpc = vi.fn();
  const schema = vi.fn(() => ({ rpc }));
  return { rpc, schema };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { schema },
}));

import {
  listarEnvolvidos,
  adicionarEnvolvido,
  removerEnvolvido,
} from "./envolvidos";

beforeEach(() => {
  rpc.mockReset();
  schema.mockClear();
});

describe("listarEnvolvidos", () => {
  it("chama cliente.membros via schema('cliente').rpc", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listarEnvolvidos("c1");
    expect(schema).toHaveBeenCalledWith("cliente");
    expect(rpc).toHaveBeenCalledWith("membros", { p_client_id: "c1" });
  });

  it("retorna o array de Envolvidos", async () => {
    const rows = [
      { user_id: "u1", papel_no_cliente: "ads_manager", entrou_em: "2026-06-03" },
    ];
    rpc.mockResolvedValue({ data: rows, error: null });
    await expect(listarEnvolvidos("c1")).resolves.toEqual(rows);
  });

  it("retorna [] quando data é null (RLS vazio honesto)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(listarEnvolvidos("c1")).resolves.toEqual([]);
  });

  it("lança quando a RPC erra (contrato não engole falha)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(listarEnvolvidos("c1")).rejects.toThrow("boom");
  });
});

describe("adicionarEnvolvido", () => {
  it("chama cliente.adicionar_membro com client/user/papel", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await adicionarEnvolvido("c1", "u1", "comercial");
    expect(schema).toHaveBeenCalledWith("cliente");
    expect(rpc).toHaveBeenCalledWith("adicionar_membro", {
      p_client_id: "c1",
      p_user_id: "u1",
      p_papel: "comercial",
    });
  });

  it("lança quando a RPC erra (ex.: permission denied / órfão)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("denied") });
    await expect(adicionarEnvolvido("c1", "u1", "comercial")).rejects.toThrow("denied");
  });
});

describe("removerEnvolvido", () => {
  it("chama cliente.remover_membro com client/user/papel", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await removerEnvolvido("c1", "u1", "ads_manager");
    expect(rpc).toHaveBeenCalledWith("remover_membro", {
      p_client_id: "c1",
      p_user_id: "u1",
      p_papel: "ads_manager",
    });
  });
});
