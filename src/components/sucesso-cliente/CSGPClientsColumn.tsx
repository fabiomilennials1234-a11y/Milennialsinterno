import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CSClient } from '@/hooks/useSucessoCliente';
import CSColumnScroll from './CSColumnScroll';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FolderKanban, Search, Rocket, Clock, User } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';

const GP_STEP_LABELS: Record<string, string> = {
  novos_clientes: 'Novos Clientes',
  // V1 steps
  call_1_agendada: 'Call 1 Agendada',
  call_1_realizada: 'Call 1 Realizada',
  // V2 steps
  realizar_call_1: 'Realizar Call 1',
  escolher_equipe: 'Escolher Equipe',
  alinhar_projeto: 'Alinhar Projeto',
  // Shared
  acompanhamento_gestores: 'Acompanhamento Gestores',
};

interface CSGPClientsColumnProps {
  clients: CSClient[];
  onClientClick?: (client: CSClient) => void;
}

/**
 * Resolve GP names by group: finds users with role 'gestor_projetos'
 * and returns Map<groupId, gpName>.
 */
function useGPNamesByGroup(groupIds: string[]) {
  const sorted = [...new Set(groupIds.filter(Boolean))].sort();
  const key = sorted.join(',');

  return useQuery({
    queryKey: ['gp-names-by-group', key],
    queryFn: async (): Promise<Map<string, string>> => {
      if (sorted.length === 0) return new Map();

      // Find users with gestor_projetos role in these groups
      const { data: gpProfiles, error } = await supabase
        .from('profiles')
        .select('user_id, name, group_id')
        .eq('role', 'gestor_projetos')
        .in('group_id', sorted);

      if (error) throw error;

      const map = new Map<string, string>();
      for (const p of gpProfiles || []) {
        if (p.group_id && p.name) {
          map.set(p.group_id, p.name);
        }
      }
      return map;
    },
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
  });
}

export default function CSGPClientsColumn({ clients, onClientClick }: CSGPClientsColumnProps) {
  const [search, setSearch] = useState('');

  // Filter: growth_gp_step NOT NULL AND != 'feito'
  const gpClients = useMemo(() =>
    clients.filter(c => c.growth_gp_step != null && c.growth_gp_step !== 'feito'),
  [clients]);

  // Resolve GP names by group
  const groupIds = useMemo(() =>
    gpClients.map(c => c.group_id).filter((id): id is string => id != null),
  [gpClients]);
  const { data: gpNamesByGroup } = useGPNamesByGroup(groupIds);

  const filtered = useMemo(() => {
    if (!search) return gpClients;
    const q = search.toLowerCase();
    return gpClients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.razao_social?.toLowerCase().includes(q)
    );
  }, [gpClients, search]);

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle shadow-apple">
      {/* Header */}
      <div className="section-header section-header-teal">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <FolderKanban size={18} className="text-white" />
            <h2 className="font-semibold text-white text-sm">Com Gestor de Projetos</h2>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {gpClients.length}
          </Badge>
        </div>
      </div>

      {/* Search */}
      {gpClients.length > 3 && (
        <div className="px-4 py-2 border-b border-subtle">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Client list */}
      <CSColumnScroll className="flex-1" contentClassName="p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderKanban className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">
              {gpClients.length === 0
                ? 'Nenhum cliente no fluxo do GP'
                : 'Nenhum resultado encontrado'}
            </p>
          </div>
        ) : (
          filtered.map(client => {
            const stepLabel = client.growth_gp_step
              ? GP_STEP_LABELS[client.growth_gp_step] || client.growth_gp_step
              : null;

            const gpName = client.group_id
              ? gpNamesByGroup?.get(client.group_id)
              : null;

            const daysInFlow = client.growth_counter_started_at
              ? differenceInDays(new Date(), new Date(client.growth_counter_started_at))
              : null;

            return (
              <div
                key={client.id}
                className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20 space-y-2 cursor-pointer hover:bg-teal-500/10 transition-colors"
                onClick={() => onClientClick?.(client)}
              >
                {/* Client name + label */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">{client.name}</span>
                    <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                  </div>
                </div>

                {/* GP Step */}
                {stepLabel && (
                  <div className="bg-teal-500/10 rounded-lg px-2.5 py-2 flex items-center gap-2">
                    <Rocket className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Etapa GP</p>
                      <p className="text-sm font-semibold text-teal-700 dark:text-teal-400 truncate">{stepLabel}</p>
                    </div>
                  </div>
                )}

                {/* GP name + days in flow */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  {gpName && (
                    <span className="flex items-center gap-1 truncate">
                      <User className="h-2.5 w-2.5 shrink-0" />
                      {gpName}
                    </span>
                  )}
                  {daysInFlow != null && (
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                      {daysInFlow === 0 ? 'Hoje' : `${daysInFlow}d no fluxo`}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CSColumnScroll>
    </div>
  );
}
