import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, CheckCircle2, Clock, AlertCircle, UserPlus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CrmTarefaFormModal from './CrmTarefaFormModal';
import { CRM_PRODUTO_LABEL, CRM_PRODUTO_COLOR, CRM_STEP_LABEL, type CrmProduto, getTorqueCrmProducts, getHighestProduct } from '@/hooks/useCrmKanban';

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
  const [selectedGestor, setSelectedGestor] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const queryClient = useQueryClient();

  const { data: client, refetch: refetchClient } = useQuery({
    queryKey: ['crm-gerar-tarefa-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, torque_crm_products, assigned_crm, crm_status')
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

  // Fetch available CRM gestors for the selector (when client has no assigned_crm)
  const { data: crmGestors = [] } = useQuery({
    queryKey: ['crm-gestors-list'],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_crm');
      if (rolesErr) throw rolesErr;
      if (!roles || roles.length === 0) return [];

      const ids = roles.map(r => r.user_id);
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', ids);
      if (profErr) throw profErr;
      return (profiles || []) as { user_id: string; name: string }[];
    },
    staleTime: 5 * 60 * 1000,
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

  const handleAssignGestor = async () => {
    if (!selectedGestor) {
      toast.error('Selecione um Gestor de CRM');
      return;
    }
    setAssigning(true);
    try {
      const { error } = await supabase.rpc('assign_crm_gestor', {
        _client_id: clientId,
        _gestor_id: selectedGestor,
      });
      if (error) throw error;

      toast.success('Gestor de CRM atribuido');
      await refetchClient();
      queryClient.invalidateQueries({ queryKey: ['crm-novos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['crm-kanban-clients'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao atribuir gestor', { description: msg });
    } finally {
      setAssigning(false);
    }
  };

  // No gestor assigned — show selector instead of blocking
  if (!gestorId) {
    return (
      <div className="bg-muted/20 rounded-xl p-4 border border-border space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Gestor de CRM</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Nenhum Gestor de CRM atribuido a este cliente. Selecione abaixo para gerar tarefas.
        </p>
        {crmGestors.length === 0 ? (
          <p className="text-xs text-destructive">
            Nenhum usuario com papel Gestor de CRM cadastrado no sistema.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Select value={selectedGestor} onValueChange={setSelectedGestor}>
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Selecionar gestor..." />
              </SelectTrigger>
              <SelectContent>
                {crmGestors.map(g => (
                  <SelectItem key={g.user_id} value={g.user_id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleAssignGestor}
              disabled={!selectedGestor || assigning}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-1.5 shrink-0"
            >
              <UserPlus size={14} />
              {assigning ? 'Atribuindo...' : 'Atribuir'}
            </Button>
          </div>
        )}
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
      {(() => {
        const highest = torqueProducts.length > 0 ? getHighestProduct(torqueProducts) : null;
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {torqueProducts.map((produto: CrmProduto) => {
              const cfg = configsByProduto.get(produto);
              const label = CRM_PRODUTO_LABEL[produto];
              const color = CRM_PRODUTO_COLOR[produto];
              const isLower = highest != null && produto !== highest;

              // Produto inferior na hierarquia — mostrar como incluso
              if (isLower) {
                return (
                  <div key={produto} className="rounded-lg border border-dashed border-border bg-muted/10 p-2.5 opacity-60">
                    <Badge className={`${color} border`}>{label}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Incluso no {CRM_PRODUTO_LABEL[highest!]}
                    </p>
                  </div>
                );
              }

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
        );
      })()}

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
