import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase client mock ──
// Verifica o COMPORTAMENTO da interface pública dos wrappers de RPC do board:
// que chamam supabase.rpc(name, args) com o contrato correto e propagam erro.
// Padrão de demandas.test.ts. vi.hoisted porque vi.mock é içado.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { gerarCardBoard, comecarCardBoard, setChecklistBoard, agendarApresentacao, marcarProntoCard } from "./boardRpc";
import type { ChecklistItem } from "./checklist";

beforeEach(() => {
  rpc.mockReset();
});

const CLIENT = "11111111-1111-1111-1111-111111111111";
const CONFIG = "22222222-2222-2222-2222-222222222222";
const GESTOR = "33333333-3333-3333-3333-333333333333";

describe("gerarCardBoard", () => {
  it("chama torque_board_gerar com o contrato (p_client_id/p_gestor_id/p_produto/p_form_data)", async () => {
    rpc.mockResolvedValue({ data: CONFIG, error: null });
    await gerarCardBoard({ clientId: CLIENT, gestorId: GESTOR, produto: "torque" });
    expect(rpc).toHaveBeenCalledWith("torque_board_gerar", {
      p_client_id: CLIENT,
      p_gestor_id: GESTOR,
      p_produto: "torque",
      p_form_data: {},
    });
  });

  it("encaminha form_data quando informado", async () => {
    rpc.mockResolvedValue({ data: CONFIG, error: null });
    await gerarCardBoard({
      clientId: CLIENT, gestorId: GESTOR, produto: "automation",
      formData: { foo: "bar" },
    });
    expect(rpc).toHaveBeenCalledWith("torque_board_gerar",
      expect.objectContaining({ p_produto: "automation", p_form_data: { foo: "bar" } }));
  });

  it("retorna o id do card criado", async () => {
    rpc.mockResolvedValue({ data: CONFIG, error: null });
    await expect(
      gerarCardBoard({ clientId: CLIENT, gestorId: GESTOR, produto: "copilot" }),
    ).resolves.toBe(CONFIG);
  });

  it("lança quando a RPC devolve erro (contrato não engole falha)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    await expect(
      gerarCardBoard({ clientId: CLIENT, gestorId: GESTOR, produto: "torque" }),
    ).rejects.toThrow("permission denied");
  });
});

describe("comecarCardBoard", () => {
  it("chama torque_board_comecar com p_config_id", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await comecarCardBoard(CONFIG);
    expect(rpc).toHaveBeenCalledWith("torque_board_comecar", { p_config_id: CONFIG });
  });

  it("lança quando a RPC rejeita (transição inválida / permission denied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "transição inválida" } });
    await expect(comecarCardBoard(CONFIG)).rejects.toThrow("transição inválida");
  });
});

describe("setChecklistBoard", () => {
  const CL: ChecklistItem[] = [
    { id: "a", label: "A", done: true },
    { id: "b", label: "B", done: false },
  ];

  it("chama torque_board_checklist_set com p_config_id e p_checklist (array inteiro)", async () => {
    rpc.mockResolvedValue({ data: "tier", error: null });
    await setChecklistBoard(CONFIG, CL);
    expect(rpc).toHaveBeenCalledWith("torque_board_checklist_set", {
      p_config_id: CONFIG,
      p_checklist: CL,
    });
  });

  it("retorna o board_status resultante (auto-move decidido no servidor)", async () => {
    rpc.mockResolvedValue({ data: "apresentacao", error: null });
    await expect(setChecklistBoard(CONFIG, CL)).resolves.toBe("apresentacao");
  });

  it("lança quando a RPC rejeita (shape inválido / permission denied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "checklist inválido" } });
    await expect(setChecklistBoard(CONFIG, CL)).rejects.toThrow("checklist inválido");
  });
});

// =============================================================
// Slice 4 (#94) — wrappers de agendamento/conclusão da APRESENTAÇÃO.
// =============================================================

describe("agendarApresentacao", () => {
  const AT = "2026-06-10T17:00:00.000Z";

  it("chama torque_board_agendar com p_config_id e p_apresentacao_at", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await agendarApresentacao(CONFIG, AT);
    expect(rpc).toHaveBeenCalledWith("torque_board_agendar", {
      p_config_id: CONFIG,
      p_apresentacao_at: AT,
    });
  });

  it("lança quando a RPC rejeita (fora de apresentacao / permission denied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "transição inválida" } });
    await expect(agendarApresentacao(CONFIG, AT)).rejects.toThrow("transição inválida");
  });
});

describe("marcarProntoCard", () => {
  it("chama torque_board_pronto com p_config_id", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await marcarProntoCard(CONFIG);
    expect(rpc).toHaveBeenCalledWith("torque_board_pronto", { p_config_id: CONFIG });
  });

  it("lança quando a RPC rejeita (antes do dia agendado / permission denied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "apresentação ainda não chegou" } });
    await expect(marcarProntoCard(CONFIG)).rejects.toThrow("apresentação ainda não chegou");
  });
});
