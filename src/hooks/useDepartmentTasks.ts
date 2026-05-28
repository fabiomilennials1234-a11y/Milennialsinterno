import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDataScope } from '@/hooks/useDataScope';
import { toast } from 'sonner';
import { CONSULTORIA_TASK_MAP, GESTAO_TASK_MAP, CONSULTORIA_DUE_DAYS, GESTAO_DUE_DAYS, getCurrentWeekday } from '@/hooks/useMktplaceKanban';
import {
  getCurrentWeekday as getCurrentWeekdayCrm,
  welcomeTaskTitle as crmWelcomeTaskTitle,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import { resolveTaskOwner } from './utils/resolveTaskOwner';
import { handleGrowthTaskCompletion } from './utils/growthTaskAutomation';
import { isClientBlockedByBriefing } from './utils/briefingBlockCheck';

// Map de department → page_slug correspondente em app_pages.
// Mantido em paralelo aos slugs declarados em types/auth.ts ROLE_PAGE_MATRIX.
const DEPARTMENT_TO_PAGE_SLUG: Record<string, string> = {
  gestor_crm: 'gestor-crm',
  consultor_mktplace: 'consultor-mktplace',
  financeiro: 'financeiro',
  gestor_projetos: 'gestor-projetos',
  rh: 'rh',
  sucesso_cliente: 'sucesso-cliente',
  outbound: 'outbound',
  gestor_ads: 'gestor-ads',
  design: 'design',
  editor_video: 'editor-video',
  devs: 'devs',
  produtora: 'produtora',
  consultor_comercial: 'consultor-comercial',
};

export interface DepartmentTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  task_type: 'daily' | 'weekly' | 'step';
  status: 'todo' | 'doing' | 'done';
  priority: string | null;
  due_date: string | null;
  department: string;
  related_client_id: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
  related_project_id?: string | null;
  project_step?: string | null;
  is_blocking?: boolean;
  advance_to_step?: string | null;
  // Joined client info (from related_client_id → clients)
  clients?: { name: string; razao_social: string | null } | null;
  // Extended fields for financeiro_tasks integration
  _source?: 'department' | 'financeiro';
  _financeiroMeta?: {
    clientId: string;
    productSlug: string;
  };
}

export function useDepartmentTasks(department: string, type: 'daily' | 'weekly' | 'all' = 'daily') {
  const { user } = useAuth();

  // page_grant: user com grant na página do department vê dados completos
  // (não é owner natural — owner já passa direto pelo RLS via has_role).
  // Admin (ceo/cto/gestor_projetos) bypass via RLS — também ignora filtro.
  const slug = DEPARTMENT_TO_PAGE_SLUG[department];
  const { seesAll, isReady, scopeKey } = useDataScope(slug);

  return useQuery({
    queryKey: ['department-tasks', user?.id, department, type, scopeKey],
    queryFn: async () => {
      // 1. Fetch regular department tasks
      let baseQuery = supabase
        .from('department_tasks')
        .select('*, clients:related_client_id(name, razao_social)')
        .eq('department', department)
        .eq('archived', false)
        .is('related_project_id' as any, null)
        .order('created_at', { ascending: false });

      // 'all' skips task_type filter — shows daily + weekly in a single column
      if (type !== 'all') {
        baseQuery = baseQuery.eq('task_type', type);
      }

      // Exclude Growth onboarding step tasks from the regular GP board — they live
      // in GrowthAcompanhamentoSection. Operational tasks like "Brifar CRM" stay.
      if (department === 'gestor_projetos') {
        baseQuery = baseQuery.or(
          'description.is.null,description.not.ilike.growth:%,description.ilike.growth:brifar_%',
        );
      }

      if (!seesAll) {
        baseQuery = baseQuery.eq('user_id', user?.id);
      }

      const { data, error } = await baseQuery;

      if (error) throw error;

      const departmentTasks = (data || []).map(t => ({
        ...t,
        _source: 'department' as const,
      })) as DepartmentTask[];

      // 2. For financeiro department, also fetch team-level financeiro_tasks
      if (department === 'financeiro' && type === 'daily') {
        const { data: finTasks, error: finError } = await supabase
          .from('financeiro_tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (!finError && finTasks) {
          const mappedFinTasks: DepartmentTask[] = finTasks.map(ft => ({
            id: ft.id,
            user_id: user?.id || '',
            title: ft.title,
            description: ft.product_slug,
            task_type: 'daily' as const,
            status: ft.status === 'done' ? 'done' as const : 'todo' as const,
            priority: 'normal',
            due_date: ft.due_date,
            department: 'financeiro',
            related_client_id: ft.client_id,
            created_at: ft.created_at,
            updated_at: ft.created_at,
            archived: false,
            archived_at: null,
            _source: 'financeiro' as const,
            _financeiroMeta: {
              clientId: ft.client_id,
              productSlug: ft.product_slug,
            },
          }));

          return [...mappedFinTasks, ...departmentTasks];
        }
      }

      return departmentTasks;
    },
    enabled: isReady && !!user?.id,
  });
}

export function useCreateDepartmentTask(department: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string;
      task_type?: 'daily' | 'weekly';
      priority?: string;
      due_date?: string;
      related_client_id?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('department_tasks')
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description || null,
          task_type: taskData.task_type || 'daily',
          priority: taskData.priority || 'normal',
          due_date: taskData.due_date || null,
          department,
          related_client_id: taskData.related_client_id || null,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa criada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar tarefa', { description: error.message });
    },
  });
}

export function useUpdateDepartmentTaskStatus(department: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, status, _source, _financeiroMeta, taskTitle }: {
      taskId: string;
      status: 'todo' | 'doing' | 'done';
      _source?: 'department' | 'financeiro';
      _financeiroMeta?: { clientId: string; productSlug: string };
      taskTitle?: string;
    }) => {
      if (_source === 'financeiro') {
        // Map department status back to financeiro_tasks status
        const finStatus = status === 'todo' ? 'pending' : status; // todo→pending, doing→doing, done→done

        if (status === 'done') {
          // 1. Mark the financeiro_task as done
          const { error: taskError } = await supabase
            .from('financeiro_tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', taskId);

          if (taskError) throw taskError;

          // 2. Activate THIS PRODUCT in financeiro_active_clients (per-product)
          if (_financeiroMeta) {
            const { data: pvData } = await supabase
              .from('client_product_values')
              .select('monthly_value')
              .eq('client_id', _financeiroMeta.clientId)
              .eq('product_slug', _financeiroMeta.productSlug)
              .single();

            const productValue = Number(pvData?.monthly_value || 0);

            if (productValue > 0) {
              // Update this specific product's monthly_value (per-product record)
              await supabase
                .from('financeiro_active_clients')
                .update({ monthly_value: productValue })
                .eq('client_id', _financeiroMeta.clientId)
                .eq('product_slug', _financeiroMeta.productSlug);
            }

            // Advance THIS PRODUCT's onboarding to contrato_assinado
            await supabase
              .from('financeiro_client_onboarding')
              .update({ current_step: 'contrato_assinado', updated_at: new Date().toISOString() })
              .eq('client_id', _financeiroMeta.clientId)
              .eq('product_slug', _financeiroMeta.productSlug);

            // N4: Check if ALL financeiro_tasks for this client are now done (for CEO notification)
            const { data: remainingTasks } = await supabase
              .from('financeiro_tasks')
              .select('id')
              .eq('client_id', _financeiroMeta.clientId)
              .neq('status', 'done');

            if (remainingTasks && remainingTasks.length === 0) {
              // All tasks done — notify CEO
              const { data: client } = await supabase
                .from('clients')
                .select('name')
                .eq('id', _financeiroMeta.clientId)
                .single();

              const { data: ceoUsers } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'ceo');

              for (const ceo of ceoUsers || []) {
                await supabase.from('system_notifications').insert({
                  recipient_id: ceo.user_id,
                  recipient_role: 'ceo',
                  notification_type: 'financeiro_tasks_completed',
                  title: '✅ Onboarding Financeiro Completo',
                  message: `Todas as tarefas financeiras do cliente "${client?.name || 'Cliente'}" foram concluídas.`,
                  client_id: _financeiroMeta.clientId,
                  priority: 'medium',
                  metadata: { completed_by: user?.id },
                } as any);
              }
            }
          }
        } else {
          // Just update the status (pending or doing)
          const { error } = await supabase
            .from('financeiro_tasks')
            .update({ status: finStatus })
            .eq('id', taskId);

          if (error) throw error;
        }

        return { _source: 'financeiro' as const, status };
      }

      // Normal department_tasks update
      // Use .select() to detect silent RLS-blocked 0-row updates:
      // Supabase returns error=null with empty data when RLS blocks the UPDATE.
      const { data: updatedRows, error } = await supabase
        .from('department_tasks')
        .update({ status } as any)
        .eq('id', taskId)
        .select('id');

      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Sem permissão para atualizar esta tarefa');
      }

      // When a financeiro department_task is completed, activate THIS PRODUCT
      let financeiroCompleted = false;
      let allClientTasksDone = false;
      if (status === 'done') {
        const { data: taskData } = await supabase
          .from('department_tasks')
          .select('related_client_id, department, description')
          .eq('id', taskId)
          .single();

        if (taskData?.department === 'financeiro' && taskData.related_client_id) {
          const clientId = taskData.related_client_id;
          const productSlug = taskData.description; // product_slug is stored in description
          financeiroCompleted = true;

          if (productSlug) {
            // Get this product's value
            const { data: pvData } = await supabase
              .from('client_product_values')
              .select('monthly_value')
              .eq('client_id', clientId)
              .eq('product_slug', productSlug)
              .maybeSingle();

            const productValue = Number(pvData?.monthly_value || 0);

            // Activate THIS product in financeiro_active_clients
            if (productValue > 0) {
              await supabase
                .from('financeiro_active_clients')
                .update({ monthly_value: productValue })
                .eq('client_id', clientId)
                .eq('product_slug', productSlug);
            }

            // Advance THIS product's onboarding to contrato_assinado
            await supabase
              .from('financeiro_client_onboarding')
              .update({ current_step: 'contrato_assinado', updated_at: new Date().toISOString() })
              .eq('client_id', clientId)
              .eq('product_slug', productSlug);
          }

          // Check if ALL financeiro department_tasks for this client are now done (for toast message)
          const { data: allClientTasks } = await supabase
            .from('department_tasks')
            .select('id, status')
            .eq('related_client_id', clientId)
            .eq('department', 'financeiro')
            .eq('archived', false);

          allClientTasksDone = !!(allClientTasks && allClientTasks.length > 0
            && allClientTasks.every((t: any) => t.status === 'done'));
        }
      }

      // ===== MKT PLACE AUTOMATION =====
      let mktplaceAdvanced = false;
      if (status === 'done') {
        const taskInfo = await supabase
          .from('department_tasks')
          .select('related_client_id, department')
          .eq('id', taskId)
          .single();

        if (taskInfo.data?.department === 'consultor_mktplace' && taskInfo.data.related_client_id) {
          const clientId = taskInfo.data.related_client_id;

          // Get client current status and type
          const { data: client } = await supabase
            .from('clients')
            .select('mktplace_status, contracted_products, name, razao_social, assigned_mktplace')
            .eq('id', clientId)
            .single();

          if (client?.mktplace_status) {
            // Check for blocking tags — prevents mktplace_status advance while
            // ADS strategy or GP briefing is pending. Task still completes normally.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: blockingTags } = await (supabase as any)
              .from('client_tags')
              .select('id, name')
              .eq('client_id', clientId)
              .in('name', ['Aguardando Estratégia de Tráfego', 'Esperar Briefing'])
              .is('dismissed_at', null)
              .limit(2);

            const isMktplaceBlocked = blockingTags && blockingTags.length > 0;
            if (isMktplaceBlocked) {
              const tagNames = (blockingTags as { id: string; name: string }[]).map(t => t.name);
              if (tagNames.includes('Aguardando Estratégia de Tráfego')) {
                toast.error('Cliente bloqueado no MKT Place', {
                  description: 'Aguardando conclusão da estratégia de tráfego (ADS) para liberar avanço.',
                });
              }
              if (tagNames.includes('Esperar Briefing')) {
                toast.error('Aguardando Briefing do GP', {
                  description: 'Esta tarefa so pode ser concluida apos o GP finalizar o briefing.',
                });
              }
            }

            const products = (client.contracted_products as string[]) || [];
            const isGestao = products.includes('gestor-mktplace');
            const clientName = client.razao_social || client.name || 'Cliente';

            // Next step maps
            const CONSULTORIA_NEXT: Record<string, string> = {
              novo: 'consultoria_marcada',
              consultoria_marcada: 'material_preparado',
              material_preparado: 'aula_ministrada',
              aula_ministrada: 'material_enviado',
              material_enviado: 'acompanhamento',
            };
            const GESTAO_NEXT: Record<string, string> = {
              novo: 'onboarding_marcado',
              onboarding_marcado: 'material_preparado_gestao',
              material_preparado_gestao: 'onboarding_realizado',
              onboarding_realizado: 'acessos_pegados',
              acessos_pegados: 'operacao_auditada',
              operacao_auditada: 'iniciar_plano',
              iniciar_plano: 'acompanhamento',
            };

            const nextMap = isGestao ? GESTAO_NEXT : CONSULTORIA_NEXT;
            const taskMap = isGestao ? GESTAO_TASK_MAP : CONSULTORIA_TASK_MAP;
            const nextStatus = nextMap[client.mktplace_status];

            if (nextStatus && !isMktplaceBlocked) {
              if (nextStatus === 'acompanhamento') {
                // Move to acompanhamento
                const trackingType = isGestao ? 'gestao' : 'consultoria';
                const acompStatus = isGestao ? 'acompanhamento_gestao' : 'acompanhamento_consultoria';
                const weekday = getCurrentWeekday();

                const { data: acompRows, error: acompErr } = await supabase
                  .from('clients')
                  .update({ mktplace_status: acompStatus })
                  .eq('id', clientId)
                  .select('id');
                if (acompErr) console.error('[MktPlace] Failed to update client mktplace_status to acompanhamento:', acompErr.message);
                if (!acompRows || acompRows.length === 0) console.error('[MktPlace] 0 rows updated — RLS likely blocked mktplace_status update for client', clientId);

                await (supabase as any).from('mktplace_daily_tracking').upsert({
                  client_id: clientId,
                  consultor_id: client.assigned_mktplace || user?.id,
                  current_day: weekday,
                  last_moved_at: new Date().toISOString(),
                  tracking_type: trackingType,
                }, { onConflict: 'client_id' });
              } else {
                // Move to next onboarding step
                const { data: stepRows, error: stepErr } = await supabase
                  .from('clients')
                  .update({ mktplace_status: nextStatus })
                  .eq('id', clientId)
                  .select('id');
                if (stepErr) console.error('[MktPlace] Failed to advance mktplace_status:', stepErr.message);
                if (!stepRows || stepRows.length === 0) console.error('[MktPlace] 0 rows updated — RLS likely blocked mktplace_status advance for client', clientId);

                // Create next task with SLA due date
                const taskNameFn = taskMap[nextStatus];
                if (taskNameFn && user?.id) {
                  const dueDaysMap = isGestao ? GESTAO_DUE_DAYS : CONSULTORIA_DUE_DAYS;
                  const dueDays = dueDaysMap[nextStatus] ?? 1;
                  const dueDate = new Date();
                  dueDate.setDate(dueDate.getDate() + dueDays);

                  const ownerId = await resolveTaskOwner(clientId, 'assigned_mktplace', user.id);
                  await supabase.from('department_tasks').insert({
                    user_id: ownerId,
                    title: taskNameFn(clientName),
                    task_type: 'daily',
                    status: 'todo',
                    priority: 'high',
                    department: 'consultor_mktplace',
                    related_client_id: clientId,
                    due_date: dueDate.toISOString(),
                  } as any);
                }
              }
              mktplaceAdvanced = true;
            }
          }
        }
      }

      // ===== GESTOR DE CRM AUTOMATION =====
      // Se a tarefa concluída é do departamento 'gestor_crm' e seu título bate
      // exatamente com o template de boas-vindas do cliente (por `related_client_id`),
      // movemos o cliente de 'boas_vindas' para 'acompanhamento' e criamos uma
      // entrada em `crm_daily_tracking` no dia útil REAL da conclusão.
      let crmWelcomeAdvanced = false;
      if (status === 'done') {
        const { data: crmTask } = await supabase
          .from('department_tasks')
          .select('related_client_id, department, title')
          .eq('id', taskId)
          .single();

        if (
          crmTask?.department === 'gestor_crm' &&
          crmTask.related_client_id
        ) {
          const clientId = crmTask.related_client_id;
          const { data: client } = await supabase
            .from('clients')
            .select('name, razao_social, crm_status, assigned_crm' as any)
            .eq('id', clientId)
            .single();

          const clientAny = client as any;
          if (clientAny?.crm_status === 'boas_vindas') {
            const clientName = clientAny.razao_social || clientAny.name || 'Cliente';
            const expectedTitle = crmWelcomeTaskTitle(clientName);
            // Só avança se o título da tarefa for exatamente a de boas-vindas
            if (crmTask.title === expectedTitle) {
              // Block CRM welcome completion when "Esperar Briefing" is active
              if (await isClientBlockedByBriefing(supabase, clientId)) {
                await supabase
                  .from('department_tasks')
                  .update({ status: 'todo' } as any)
                  .eq('id', taskId);
                return {
                  _source: 'department' as const, status, financeiroCompleted: false,
                  allClientTasksDone: false, mktplaceAdvanced: false, crmWelcomeAdvanced: false,
                  crmConfigAdvanced: false, crmConfigFinalized: false, crmValidationBlocked: false, crmValidationBlockers: null,
                  growthAdvanced: false, growthTeamSelectionNeeded: null, growthOnboardingComplete: false,
                  crmBriefingBlocked: true,
                };
              }

              const weekday = getCurrentWeekdayCrm();
              await supabase
                .from('clients')
                .update({ crm_status: 'acompanhamento' } as any)
                .eq('id', clientId);

              await (supabase as any).from('crm_daily_tracking').upsert({
                client_id: clientId,
                gestor_id: clientAny.assigned_crm || user?.id,
                current_day: weekday,
                last_moved_at: new Date().toISOString(),
                is_delayed: false,
              }, { onConflict: 'client_id' });
              crmWelcomeAdvanced = true;
            }
          }
        }
      }

      // ===== GESTOR DE CRM — MOTOR DE CONFIGURAÇÃO (V8 / Automation / Copilot) =====
      // Se a tarefa tem description='crm-config:{produto}', identifica a configuração
      // pela combinação (client_id, produto) — sem ambiguidade entre cards de produtos
      // diferentes do mesmo cliente — e avança o step via RPC `advance_crm_step`.
      // O RPC valida checklist + campos obrigatórios + bloqueio temporal antes de avançar.
      // Se a validação falha, a tarefa volta para 'todo' e o usuário é notificado.
      let crmConfigAdvanced = false;
      let crmConfigFinalized = false;
      let crmValidationBlocked = false;
      let crmValidationBlockers: string[] | null = null;
      if (status === 'done') {
        const { data: cfgTask } = await supabase
          .from('department_tasks')
          .select('related_client_id, department, description')
          .eq('id', taskId)
          .single();

        const desc = (cfgTask as any)?.description as string | null | undefined;
        if (
          cfgTask?.department === 'gestor_crm' &&
          cfgTask.related_client_id &&
          desc &&
          desc.startsWith('crm-config:')
        ) {
          const produto = desc.slice('crm-config:'.length) as CrmProduto;
          if (['v8', 'automation', 'copilot'].includes(produto)) {
            const { data: cfg } = await (supabase as any)
              .from('crm_configuracoes')
              .select('id, current_step, is_finalizado, created_at')
              .eq('client_id', cfgTask.related_client_id)
              .eq('produto', produto)
              .eq('is_finalizado', false)
              .maybeSingle();

            if (cfg && !cfg.is_finalizado) {
              // Call server-side validation RPC
              const { data: rpcResult, error: rpcError } = await (supabase as any).rpc('advance_crm_step', {
                _config_id: cfg.id,
                _performed_by: user?.id || null,
              });

              if (rpcError) {
                console.error('[CRM] advance_crm_step RPC error:', rpcError.message);
                // Fallback: don't block, let old behavior handle it
              } else if (rpcResult && !rpcResult.allowed) {
                // Validation failed — revert task to 'todo'
                await supabase
                  .from('department_tasks')
                  .update({ status: 'todo' } as any)
                  .eq('id', taskId);
                crmValidationBlocked = true;
                crmValidationBlockers = (rpcResult.blockers as string[]) || null;
              } else if (rpcResult?.allowed) {
                if (rpcResult.finalized) {
                  crmConfigFinalized = true;
                } else {
                  // Step advanced by RPC — no task creation needed.
                  // Steps are now managed via CrmValidationGate checklist.
                  crmConfigAdvanced = true;
                }
              }
            }
          }
        }
      }

      // ===== GROWTH ONBOARDING AUTOMATION =====
      // Extracted to pure function for testability and reuse.
      let growthAdvanced = false;
      let growthTeamSelectionNeeded: string | null = null;
      let growthOnboardingComplete = false;
      if (status === 'done') {
        const growthResult = await handleGrowthTaskCompletion(supabase, taskId, user?.id);
        growthAdvanced = growthResult.growthAdvanced;
        growthTeamSelectionNeeded = growthResult.growthTeamSelectionNeeded;
        growthOnboardingComplete = growthResult.growthOnboardingComplete;
      }

      return { _source: 'department' as const, status, financeiroCompleted, allClientTasksDone, mktplaceAdvanced, crmWelcomeAdvanced, crmConfigAdvanced, crmConfigFinalized, crmValidationBlocked, crmValidationBlockers, growthAdvanced, growthTeamSelectionNeeded, growthOnboardingComplete, crmBriefingBlocked: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tech', 'projects'] });
      if (result?.crmValidationBlocked) {
        queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
        queryClient.invalidateQueries({ queryKey: ['crm-configs-for-client'] });
        queryClient.invalidateQueries({ queryKey: ['crm-config-state'] });
        const blockerList = result.crmValidationBlockers;
        if (blockerList && blockerList.length > 0) {
          toast.error('Nao foi possivel concluir', {
            description: blockerList.join('\n'),
          });
        } else {
          toast.error('Etapa com pendencias', {
            description: 'Complete o checklist e campos obrigatorios antes de concluir.',
          });
        }
      }
      if (result?.crmBriefingBlocked) {
        toast.error('Aguardando Briefing do GP', {
          description: 'Esta tarefa so pode ser concluida apos o GP finalizar o briefing.',
        });
      }
      if (result?.crmConfigAdvanced) {
        queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
        queryClient.invalidateQueries({ queryKey: ['crm-configs-for-client'] });
        queryClient.invalidateQueries({ queryKey: ['crm-config-state'] });
        toast.success('Etapa concluída — próxima tarefa criada!');
      }
      if (result?.crmConfigFinalized) {
        queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
        queryClient.invalidateQueries({ queryKey: ['crm-configs-for-client'] });
        queryClient.invalidateQueries({ queryKey: ['crm-config-state'] });
        toast.success('CRM finalizado! Card movido para "CRMs Finalizados".');
      }
      if (result?.crmWelcomeAdvanced) {
        queryClient.invalidateQueries({ queryKey: ['crm-novos-clientes'] });
        queryClient.invalidateQueries({ queryKey: ['crm-boasvindas-clientes'] });
        queryClient.invalidateQueries({ queryKey: ['crm-kanban-clients'] });
        queryClient.invalidateQueries({ queryKey: ['crm-tracking'] });
        toast.success('Cliente movido para acompanhamento diário!');
      }
      if (result?.mktplaceAdvanced) {
        queryClient.invalidateQueries({ queryKey: ['mktplace-all-clients'] });
        queryClient.invalidateQueries({ queryKey: ['mktplace-new-clients'] });
        queryClient.invalidateQueries({ queryKey: ['mktplace-tracking'] });
        toast.success('Cliente avançado automaticamente!');
      }
      if (result?.financeiroCompleted) {
        queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
        queryClient.invalidateQueries({ queryKey: ['financeiro-onboarding'] });
        queryClient.invalidateQueries({ queryKey: ['novo-cliente-product-values'] });
        if (result?.allClientTasksDone) {
          toast.success('Todas as tarefas concluídas! Cliente ativado.');
        } else {
          toast.success('Tarefa concluída!');
        }
      }
      if (result?.growthAdvanced || result?.growthOnboardingComplete) {
        queryClient.invalidateQueries({ queryKey: ['growth-novos-clientes'] });
        queryClient.invalidateQueries({ queryKey: ['growth-gp-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['growth-acompanhamento'] });
        queryClient.invalidateQueries({ queryKey: ['client-tags'] });
        queryClient.invalidateQueries({ queryKey: ['client-tags-batch'] });
        if (result?.growthOnboardingComplete) {
          toast.success('Onboarding Growth concluido!');
        } else {
          toast.success('Tarefa Growth concluida — proxima criada!');
        }
      }
      // growthTeamSelectionNeeded is handled by the caller (page component)
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar tarefa', { description: error.message });
    },
  });
}

export function useUpdateDepartmentTask(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, ...data }: { taskId: string; title?: string; description?: string }) => {
      const { error } = await supabase
        .from('department_tasks')
        .update(data as any)
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar tarefa', { description: error.message });
    },
  });
}

export function useArchiveDepartmentTask(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, _source }: { taskId: string; _source?: 'department' | 'financeiro' }) => {
      // Financeiro tasks don't support archiving — just skip
      if (_source === 'financeiro') return;

      const { data: archivedRows, error } = await supabase
        .from('department_tasks')
        .update({
          archived: true,
          archived_at: new Date().toISOString()
        } as any)
        .eq('id', taskId)
        .select('id');

      if (error) throw error;
      if (!archivedRows || archivedRows.length === 0) {
        throw new Error('Sem permissão para arquivar esta tarefa');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-project-tasks'] });
      toast.success('Tarefa arquivada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao arquivar tarefa', { description: error.message });
    },
  });
}

export function useArchivedDepartmentTasks(department: string, type: 'daily' | 'weekly' | 'all' = 'daily') {
  const { user } = useAuth();
  const slug = DEPARTMENT_TO_PAGE_SLUG[department];
  const { seesAll, isReady, scopeKey } = useDataScope(slug);

  return useQuery({
    queryKey: ['archived-department-tasks', user?.id, department, type, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from('department_tasks')
        .select('*, clients:related_client_id(name, razao_social)')
        .eq('department', department)
        .eq('archived', true)
        .is('related_project_id' as any, null)
        .order('archived_at', { ascending: false });

      if (type !== 'all') {
        query = query.eq('task_type', type);
      }

      if (department === 'gestor_projetos') {
        query = query.or(
          'description.is.null,description.not.ilike.growth:%,description.ilike.growth:brifar_%',
        );
      }

      if (!seesAll) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DepartmentTask[];
    },
    enabled: isReady && !!user?.id,
  });
}

export function useUnarchiveDepartmentTask(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { data: rows, error } = await supabase
        .from('department_tasks')
        .update({
          archived: false,
          archived_at: null,
        } as any)
        .eq('id', taskId)
        .select('id');

      if (error) throw error;
      if (!rows || rows.length === 0) {
        throw new Error('Sem permissão para desarquivar esta tarefa');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });
      toast.success('Tarefa desarquivada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao desarquivar tarefa', { description: error.message });
    },
  });
}

export function useDeleteDepartmentTask(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, _source }: { taskId: string; _source?: 'department' | 'financeiro' }) => {
      // Financeiro tasks should not be deleted from here
      if (_source === 'financeiro') return;

      const { data: deletedRows, error } = await supabase
        .from('department_tasks')
        .delete()
        .eq('id', taskId)
        .select('id');

      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error('Sem permissão para excluir esta tarefa');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });
      toast.success('Tarefa excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir tarefa', { description: error.message });
    },
  });
}
