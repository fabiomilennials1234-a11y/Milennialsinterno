// src/lib/torqueCrm/acompanhamentoRpc.test.ts
//
// Slice 5 (#95) + Slice 6 (#96) — wrappers tipados das RPCs do board de
// Acompanhamentos. Verifica o COMPORTAMENTO da interface pública: chamam
// supabase.rpc(name, args) com o contrato correto e propagam erro. Padrão de
// boardRpc.test.ts. vi.hoisted porque vi.mock é içado.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { moverAcompanhamento, setChecklistAcompanhamento } from "./acompanhamentoRpc";
import type { ChecklistItem } from "./checklist";

beforeEach(() => {
  rpc.mockReset();
});

const ACOMP = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("moverAcompanhamento (Slice #95)", () => {
  it("chama torque_acomp_mover com p_acomp_id e p_coluna", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await moverAcompanhamento(ACOMP, "aguardando_resposta");
    expect(rpc).toHaveBeenCalledWith("torque_acomp_mover", {
      p_acomp_id: ACOMP,
      p_coluna: "aguardando_resposta",
    });
  });

  it("lança quando a RPC rejeita (coluna inválida / permission denied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    await expect(moverAcompanhamento(ACOMP, "fazer_follow_up")).rejects.toThrow("permission denied");
  });
});

describe("setChecklistAcompanhamento (Slice #96)", () => {
  const CL: ChecklistItem[] = [
    { id: "t1", label: "Ligar pro cliente", done: true },
    { id: "t2", label: "Enviar relatório", done: false },
  ];

  it("chama torque_acomp_checklist_set com p_acomp_id e p_checklist (array inteiro)", async () => {
    rpc.mockResolvedValue({ data: "tasks_em_aberto", error: null });
    await setChecklistAcompanhamento(ACOMP, CL);
    expect(rpc).toHaveBeenCalledWith("torque_acomp_checklist_set", {
      p_acomp_id: ACOMP,
      p_checklist: CL,
    });
  });

  it("retorna a coluna resultante (auto-move decidido ATÔMICO no servidor)", async () => {
    // Todas marcadas → servidor auto-move tasks_em_aberto -> fazer_follow_up.
    rpc.mockResolvedValue({ data: "fazer_follow_up", error: null });
    await expect(setChecklistAcompanhamento(ACOMP, CL)).resolves.toBe("fazer_follow_up");
  });

  it("lança quando a RPC rejeita (shape inválido / permission denied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "checklist inválido" } });
    await expect(setChecklistAcompanhamento(ACOMP, CL)).rejects.toThrow("checklist inválido");
  });
});
