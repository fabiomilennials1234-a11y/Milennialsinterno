import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase client mock ──
// Registra .schema('cliente').rpc('card_universal', args) e devolve um resultado
// controlado. Testa o COMPORTAMENTO da interface pública do wrapper do contrato
// (lerCardUniversal), não a implementação. Espelha existe.test.ts.
const { rpc, schema } = vi.hoisted(() => {
  const rpc = vi.fn();
  const schema = vi.fn(() => ({ rpc }));
  return { rpc, schema };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { schema },
}));

import { lerCardUniversal } from "./cardUniversal";

const CLIENT_ID = "ca000000-0000-0000-0000-0000000c1100";

const linhaExemplo = {
  client_id: CLIENT_ID,
  brand_colors: "#FF0055",
  typography: null,
  visual_style: null,
  brand_manual_url: null,
  logo_url: null,
  website_url: "https://cu-client.test",
  instagram_handle: null,
  youtube_channel: null,
  tiktok_handle: null,
  domain: null,
  editing_style: null,
  video_formats: null,
  cms_platform: null,
  figma_url: null,
  notes: "nota",
  updated_at: "2026-06-03T00:00:00Z",
  updated_by: "ca000000-0000-0000-0000-0000000000a1",
};

beforeEach(() => {
  rpc.mockReset();
  schema.mockClear();
});

describe("lerCardUniversal", () => {
  it("chama o contrato cliente.card_universal via schema('cliente').rpc", async () => {
    rpc.mockResolvedValue({ data: [linhaExemplo], error: null });
    await lerCardUniversal(CLIENT_ID);
    expect(schema).toHaveBeenCalledWith("cliente");
    expect(rpc).toHaveBeenCalledWith("card_universal", { p_client_id: CLIENT_ID });
  });

  it("retorna a primeira (única) linha quando o caller pode ver o cliente", async () => {
    rpc.mockResolvedValue({ data: [linhaExemplo], error: null });
    await expect(lerCardUniversal(CLIENT_ID)).resolves.toEqual(linhaExemplo);
  });

  it("retorna null quando a RPC devolve VAZIO (não-envolvido — gate de audiência)", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(lerCardUniversal(CLIENT_ID)).resolves.toBeNull();
  });

  it("retorna null quando a RPC devolve data null", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(lerCardUniversal(CLIENT_ID)).resolves.toBeNull();
  });

  it("lança quando a RPC devolve erro (contrato não engole falha)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(lerCardUniversal(CLIENT_ID)).rejects.toThrow("boom");
  });
});
