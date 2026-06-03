import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase client mock ──
// Registra .schema('cliente').rpc('editar_card_universal', params) e devolve um
// resultado controlado. Testa o COMPORTAMENTO da interface pública do wrapper de
// escrita (editarCardUniversal), não a implementação. Espelha cardUniversal.test.ts.
const { rpc, schema } = vi.hoisted(() => {
  const rpc = vi.fn();
  const schema = vi.fn(() => ({ rpc }));
  return { rpc, schema };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { schema },
}));

import { editarCardUniversal } from "./editarCardUniversal";

const CLIENT_ID = "ec000000-0000-0000-0000-0000000c1100";
const NEW_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  rpc.mockReset();
  schema.mockClear();
});

describe("editarCardUniversal", () => {
  it("chama o contrato cliente.editar_card_universal via schema('cliente').rpc", async () => {
    rpc.mockResolvedValue({ data: NEW_ID, error: null });
    await editarCardUniversal(CLIENT_ID, { brand_colors: "#0A84FF" });
    expect(schema).toHaveBeenCalledWith("cliente");
    expect(rpc).toHaveBeenCalledWith("editar_card_universal", {
      p_client_id: CLIENT_ID,
      p_brand_colors: "#0A84FF",
    });
  });

  it("envia SÓ as chaves presentes no patch (ausência = não mexer / COALESCE)", async () => {
    rpc.mockResolvedValue({ data: NEW_ID, error: null });
    await editarCardUniversal(CLIENT_ID, { typography: "Inter", figma_url: "https://figma.test" });
    const [, params] = rpc.mock.calls[0];
    expect(params).toEqual({
      p_client_id: CLIENT_ID,
      p_typography: "Inter",
      p_figma_url: "https://figma.test",
    });
    // Campos não passados NÃO devem aparecer (não vira p_brand_colors: undefined).
    expect(params).not.toHaveProperty("p_brand_colors");
    expect(params).not.toHaveProperty("p_website_url");
  });

  it("mapeia null explícito para p_<campo>: null (limpar campo intencionalmente)", async () => {
    rpc.mockResolvedValue({ data: NEW_ID, error: null });
    await editarCardUniversal(CLIENT_ID, { notes: null });
    const [, params] = rpc.mock.calls[0];
    expect(params).toEqual({ p_client_id: CLIENT_ID, p_notes: null });
  });

  it("retorna o id da linha do banco de info", async () => {
    rpc.mockResolvedValue({ data: NEW_ID, error: null });
    await expect(editarCardUniversal(CLIENT_ID, { notes: "x" })).resolves.toBe(NEW_ID);
  });

  it("lança quando a RPC devolve erro (gate 42501 / P0002 propagam)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("permission denied") });
    await expect(editarCardUniversal(CLIENT_ID, { brand_colors: "#x" })).rejects.toThrow(
      "permission denied",
    );
  });

  it("patch vazio chama a RPC só com p_client_id (no-op idempotente)", async () => {
    rpc.mockResolvedValue({ data: NEW_ID, error: null });
    await editarCardUniversal(CLIENT_ID, {});
    expect(rpc).toHaveBeenCalledWith("editar_card_universal", { p_client_id: CLIENT_ID });
  });
});
