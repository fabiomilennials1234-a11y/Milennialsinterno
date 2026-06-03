import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase client mock ──
// Registra a chamada .schema('cliente').rpc('existe', args) e devolve um
// resultado controlado. O teste verifica o COMPORTAMENTO da interface pública
// do wrapper do contrato (clienteExiste), não a implementação interna.
// `vi.hoisted` porque `vi.mock` é içado acima das declarações const.
const { rpc, schema } = vi.hoisted(() => {
  const rpc = vi.fn();
  const schema = vi.fn(() => ({ rpc }));
  return { rpc, schema };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { schema },
}));

import { clienteExiste } from "./existe";

beforeEach(() => {
  rpc.mockReset();
  schema.mockClear();
});

describe("clienteExiste", () => {
  it("chama o contrato cliente.existe via schema('cliente').rpc", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await clienteExiste("11111111-1111-1111-1111-111111111111");
    expect(schema).toHaveBeenCalledWith("cliente");
    expect(rpc).toHaveBeenCalledWith("existe", {
      p_client_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("retorna true quando o cliente existe", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(clienteExiste("abc")).resolves.toBe(true);
  });

  it("retorna false quando o cliente não existe", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(clienteExiste("abc")).resolves.toBe(false);
  });

  it("lança quando a RPC devolve erro (contrato não engole falha)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(clienteExiste("abc")).rejects.toThrow("boom");
  });
});
