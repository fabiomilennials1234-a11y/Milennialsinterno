import { useMemo } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserPlus, Clock, Rocket, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CrmClient {
  id: string;
  name: string;
  razao_social: string | null;
  status: string | null;
  client_label: string | null;
  assigned_crm: string | null;
  entry_date: string | null;
  created_at: string;
  archived: boolean;
  contracted_products: string[] | null;
}

// Colunas do kanban CRM
const CRM_COLUMNS = [
  { id: 'new_client', title: 'Novo Cliente', icon: UserPlus, color: 'bg-blue-500' },
  { id: 'onboarding', title: 'Onboarding', icon: Clock, color: 'bg-amber-500' },
  { id: 'campaign_published', title: 'Campanha Publicada', icon: Rocket, color: 'bg-green-500' },
  { id: 'acompanhamento', title: 'Acompanhamento', icon: Eye, color: 'bg-purple-500' },
  { id: 'concluido', title: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-500' },
  { id: 'churned', title: 'Churn', icon: AlertTriangle, color: 'bg-red-500' },
];

function useCrmClients(targetUserId?: string) {
  const { user, isCEO } = useAuth();
  const effectiveUserId = targetUserId || user?.id;

  return useQuery({
    queryKey: ['crm-clients', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, razao_social, status, client_label, assigned_crm, entry_date, created_at, archived, contracted_products')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      // Se tem um userId alvo (via URL), filtrar por ele
      if (targetUserId) {
        query = query.eq('assigned_crm', targetUserId);
      } else if (user?.role === 'gestor_crm') {
        query = query.eq('assigned_crm', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter(c => c.assigned_crm) as CrmClient[];
    },
    enabled: !!user,
  });
}

export default function GestorCRMPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user, isCEO, isAdminUser } = useAuth();
  const { data: clients = [], isLoading } = useCrmClients(userId);

  // Buscar nome do gestor quando acessado via URL com userId
  const { data: managerProfile } = useQuery({
    queryKey: ['crm-manager-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('user_id', userId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!userId,
  });

  const allowedRoles = ['gestor_crm', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  // Agrupar clientes por status (coluna)
  const columnClients = useMemo(() => {
    const map: Record<string, CrmClient[]> = {};
    CRM_COLUMNS.forEach(col => { map[col.id] = []; });

    clients.forEach(client => {
      const status = client.status || 'new_client';
      if (map[status]) {
        map[status].push(client);
      } else {
        // Se status não bate com nenhuma coluna, coloca em "Novo Cliente"
        map['new_client'].push(client);
      }
    });

    return map;
  }, [clients]);

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-display text-foreground">
              Gestor de CRM{managerProfile ? ` (${managerProfile.name})` : ''}
            </h1>
            <span className="text-sm text-muted-foreground">
              {clients.length} cliente{clients.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-caption text-muted-foreground mt-1">
            Kanban de gestão de clientes CRM
          </p>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
          <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
            {CRM_COLUMNS.map(column => {
              const Icon = column.icon;
              const colClients = columnClients[column.id] || [];

              return (
                <div
                  key={column.id}
                  className="w-[300px] flex-shrink-0 flex flex-col bg-card rounded-xl border border-subtle overflow-hidden"
                >
                  {/* Column Header */}
                  <div className={`px-4 py-3 flex items-center gap-2 ${column.color} text-white`}>
                    <Icon size={16} />
                    <span className="font-semibold text-sm">{column.title}</span>
                    <span className="ml-auto text-xs font-mono opacity-80">{colClients.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple">
                    {isLoading ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
                    ) : colClients.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8 opacity-50">
                        Nenhum cliente
                      </p>
                    ) : (
                      colClients.map(client => (
                        <div
                          key={client.id}
                          className="p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{client.name}</p>
                              {client.razao_social && (
                                <p className="text-[10px] text-muted-foreground truncate">{client.razao_social}</p>
                              )}
                            </div>
                            <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-muted-foreground">
                              {client.entry_date
                                ? format(parseISO(client.entry_date), 'dd/MM/yy')
                                : format(parseISO(client.created_at), 'dd/MM/yy')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
