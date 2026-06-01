import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGrowthTaskCompletion } from './growthTaskAutomation';

// ── Supabase mock builder ───────────────────────────────────────────────────
function mockSupabase(overrides: {
  task?: Record<string, unknown> | null;
  client?: Record<string, unknown> | null;
  existingGrowthTasks?: { id: string }[];
  rpcResult?: Record<string, unknown> | null;
}) {
  const rpcSpy = vi.fn().mockResolvedValue({ data: overrides.rpcResult ?? null, error: null });

  // Update chain must satisfy BOTH:
  //   clients:     .update().eq()                  (awaited after 1 eq)
  //   client_tags: .update().eq().eq().is()        (awaited after is)
  // Each link is chainable AND thenable, so awaiting at any depth resolves.
  const updateResult = { data: [{}], error: null };
  function makeUpdateChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      eq: vi.fn(() => makeUpdateChain()),
      is: vi.fn(() => makeUpdateChain()),
      then: (resolve: (v: typeof updateResult) => unknown) =>
        Promise.resolve(updateResult).then(resolve),
    };
    return chain;
  }
  const updateSpy = vi.fn(() => makeUpdateChain());

  const insertSpy = vi.fn().mockResolvedValue({ data: [{}], error: null });

  const fromSpy = vi.fn().mockImplementation((table: string) => {
    if (table === 'department_tasks') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, _val: unknown) => ({
            single: vi.fn().mockResolvedValue({ data: overrides.task ?? null, error: null }),
            // chain for existing growth tasks query
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({
                        data: overrides.existingGrowthTasks ?? [],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          })),
        }),
        insert: insertSpy,
        update: updateSpy,
      };
    }
    if (table === 'clients') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: overrides.client ?? null, error: null }),
          }),
        }),
        update: updateSpy,
      };
    }
    // fallback
    return {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      insert: insertSpy,
      update: updateSpy,
    };
  });

  return {
    supabase: { from: fromSpy, rpc: rpcSpy } as any,
    fromSpy,
    rpcSpy,
    updateSpy,
    insertSpy,
  };
}

describe('handleGrowthTaskCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('v1 client: align_project sets growth_onboarding_step to null', async () => {
    const { supabase, rpcSpy } = mockSupabase({
      task: {
        department: 'gestor_projetos',
        related_client_id: 'client-1',
        title: 'Alinhar Projeto com Equipe + Adicionar no grupo Test',
        description: 'growth:align_project',
      },
      client: {
        name: 'Test',
        razao_social: null,
        growth_onboarding_step: 'alinhar_projeto',
        growth_flow_version: 1,
      },
    });

    const result = await handleGrowthTaskCompletion(supabase, 'task-1', 'user-1');

    expect(result.growthOnboardingComplete).toBe(true);
    // V1 should NOT call the RPC
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('v2 client: align_project calls growth_advance_gp_step RPC', async () => {
    const { supabase, rpcSpy } = mockSupabase({
      task: {
        department: 'gestor_projetos',
        related_client_id: 'client-2',
        title: 'Alinhar Projeto com Equipe + Adicionar no grupo Test V2',
        description: 'growth:alinhar_projeto',
      },
      client: {
        name: 'Test V2',
        razao_social: null,
        growth_onboarding_step: 'alinhar_projeto',
        growth_flow_version: 2,
      },
    });

    const result = await handleGrowthTaskCompletion(supabase, 'task-2', 'user-1');

    expect(result.growthOnboardingComplete).toBe(true);
    // V2 MUST call the advance RPC
    expect(rpcSpy).toHaveBeenCalledWith('growth_advance_gp_step', {
      p_client_id: 'client-2',
      p_new_step: 'acompanhamento_gestores',
    });
  });

  it('v2 client without growth_flow_version field falls back to v1 behavior', async () => {
    const { supabase, rpcSpy } = mockSupabase({
      task: {
        department: 'gestor_projetos',
        related_client_id: 'client-3',
        title: 'Alinhar Projeto com Equipe + Adicionar no grupo Test',
        description: 'growth:align_project',
      },
      client: {
        name: 'Test Legacy',
        razao_social: null,
        growth_onboarding_step: null,
        // no growth_flow_version — should default to v1
      },
    });

    const result = await handleGrowthTaskCompletion(supabase, 'task-3', 'user-1');

    expect(result.growthOnboardingComplete).toBe(true);
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});
