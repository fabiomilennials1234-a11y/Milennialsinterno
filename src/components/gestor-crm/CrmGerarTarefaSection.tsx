import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wand2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CrmTarefaFormModal from './CrmTarefaFormModal';
import { CRM_PRODUTO_LABEL, CRM_PRODUTO_COLOR, CRM_STEP_LABEL, type CrmProduto, getTorqueCrmProducts } from '@/hooks/useCrmKanban';

interface Props {
  clientId: string;
  clientName: string;
}

/**
 * Área "Gerar tarefa Gestor de CRM" renderizada dentro do olhinho do cliente.
 * Aparece somente se o cliente tem Torque CRM + sub-produtos contratados.
 *
 * Mostra:
 *   - Botão amarelo "Gerar tarefa" (abre o formulário dinâmico)
 *   - Status das configurações já criadas (uma por produto):
 *       * etapa atual
 *       * barra de progresso na state-machine
 *       * flag finalizado
 */
export default function CrmGerarTarefaSection({ clientId, clientName }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ['crm-gerar-tarefa-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, torque_crm_products, assigned_crm')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: configs = [], refetch: refetchConfigs } = useQuery({
    queryKey: ['crm-configs-for-client', clientId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_configuracoes')
        .select('id, produto, current_step, is_finalizado, finalizado_at, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  if (!client) return null;

  const hasTorqueCrm = (client.contracted_products as string[] | null)?.includes('torque-crm');
  if (!hasTorqueCrm) return null;

  const torqueProducts = getTorqueCrmProducts(client);
  const gestorId = client.assigned_crm as string | null;

  if (torqueProducts.length === 0) {
    return (
      <div className="bg-muted/20 rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle size={16} />
          Torque CRM contratado mas nenhum sub-produto (V8/Automation/Copilot) selecionado no cadastro.
        </div>
      </div>
    );
  }

  if (!gestorId) {
    return (
      <div className="bg-muted/20 rounded-xl p-4 border border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle size={16} />
          Atribua um Gestor de CRM ao cliente para gerar tarefas.
        </div>
      </div>
    );
  }

  // Configurações por produto (dedup — tabela já tem UNIQUE client+produto)
  const configsByProduto = new Map<string, any>();
  configs.forEach((c: any) => configsByProduto.set(c.produto, c));

  return (
    <div className="bg-muted/20 rounded-xl p-4 border border-border space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Gerar tarefa Gestor de CRM</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configura V8 / Automation / Copilot e cria cards independentes no kanban do Gestor de CRM.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-1.5"
        >
          <Wand2 size={14} />
          Gerar tarefa
        </Button>
      </div>

      {/* Status das configurações existentes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {torqueProducts.map((produto: CrmProduto) => {
          const cfg = configsByProduto.get(produto);
          const label = CRM_PRODUTO_LABEL[produto];
          const color = CRM_PRODUTO_COLOR[produto];

          if (!cfg) {
            return (
              <div key={produto} className="rounded-lg border border-dashed border-border bg-background p-2.5">
                <Badge className={`${color} border`}>{label}</Badge>
                <p className="text-[11px] text-muted-foreground mt-1.5">Nenhuma configuração criada ainda</p>
              </div>
            );
          }

          if (cfg.is_finalizado) {
            return (
              <div key={produto} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                <div className="flex items-center gap-1.5">
                  <Badge className={`${color} border`}>{label}</Badge>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
                <p className="text-[11px] text-emerald-700 mt-1.5 font-semibold">Finalizado</p>
              </div>
            );
          }

          return (
            <div key={produto} className="rounded-lg border border-border bg-background p-2.5">
              <Badge className={`${color} border`}>{label}</Badge>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Clock size={10} />
                {CRM_STEP_LABEL[cfg.current_step] || cfg.current_step}
              </p>
            </div>
          );
        })}
      </div>

      <CrmTarefaFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        clientId={clientId}
        clientName={clientName}
        gestorId={gestorId}
        availableProdutos={torqueProducts}
        onSuccess={() => refetchConfigs()}
      />
    </div>
  );
}
