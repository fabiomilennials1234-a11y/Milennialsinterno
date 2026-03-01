import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFinanceiroOnboarding } from './useFinanceiroOnboarding';

/**
 * Auto-creates a department_task for each client-PRODUCT in the 'novo_cliente' step
 * of the financeiro onboarding (per-product).
 * Each onboarding record now has product_slug/product_name.
 */
export function useAutoCreateFinanceiroTasks() {
  const { user } = useAuth();
  const { getClientsByStep } = useFinanceiroOnboarding();
  const queryClient = useQueryClient();
  const processedRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  const novoClientes = getClientsByStep('novo_cliente');

  useEffect(() => {
    if (!user || novoClientes.length === 0 || isProcessingRef.current) return;

    const createTasks = async () => {
      isProcessingRef.current = true;
      let created = false;

      for (const record of novoClientes) {
        const clientId = record.client_id;
        const productSlug = record.product_slug;
        const productName = record.product_name;
        const key = `${clientId}:${productSlug}`;

        if (processedRef.current.has(key)) continue;

        try {
          // Check if active task already exists for this client+product
          const { data: existing } = await supabase
            .from('department_tasks')
            .select('id')
            .eq('related_client_id', clientId)
            .eq('department', 'financeiro')
            .eq('description', productSlug)
            .eq('archived', false)
            .neq('status', 'done')
            .limit(1)
            .maybeSingle();

          if (!existing) {
            const clientName = record.client?.razao_social || record.client?.name || 'Cliente';

            const { error } = await supabase
              .from('department_tasks')
              .insert({
                user_id: user.id,
                title: `${clientName} — ${productName} → Cadastrar no Asaas + Enviar 1ª Cobrança`,
                description: productSlug,
                task_type: 'daily',
                status: 'todo',
                priority: 'high',
                department: 'financeiro',
                related_client_id: clientId,
                due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              } as any);

            if (error) {
              console.error('[useAutoCreateFinanceiroTasks] Erro ao criar tarefa:', error);
            } else {
              created = true;
            }
          }

          processedRef.current.add(key);
        } catch (error) {
          processedRef.current.add(key);
        }
      }

      isProcessingRef.current = false;
      if (created) {
        queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      }
    };

    createTasks();
  }, [user?.id, novoClientes.length]);
}
