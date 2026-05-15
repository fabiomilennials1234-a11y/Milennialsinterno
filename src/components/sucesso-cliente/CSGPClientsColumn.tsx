import { useMemo, useState } from 'react';
import { CSClient } from '@/hooks/useSucessoCliente';
import CSColumnScroll from './CSColumnScroll';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FolderKanban, Search, Rocket, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';

const STEP_LABELS: Record<string, string> = {
  briefing: 'Briefing',
  configuracao: 'Configuração',
  criativos: 'Criativos',
  campanha: 'Campanha',
  revisao: 'Revisão',
  publicacao: 'Publicação',
};

interface CSGPClientsColumnProps {
  clients: CSClient[];
  onClientClick?: (client: CSClient) => void;
}

export default function CSGPClientsColumn({ clients, onClientClick }: CSGPClientsColumnProps) {
  const [search, setSearch] = useState('');

  const gpClients = useMemo(() =>
    clients.filter(c => c.growth_onboarding_step != null),
  [clients]);

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
            const stepLabel = client.growth_onboarding_step
              ? STEP_LABELS[client.growth_onboarding_step] || client.growth_onboarding_step
              : null;

            return (
              <div
                key={client.id}
                className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20 space-y-2 cursor-pointer hover:bg-teal-500/10 transition-colors"
                onClick={() => onClientClick?.(client)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">{client.name}</span>
                    <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                  </div>
                </div>

                {stepLabel && (
                  <div className="bg-teal-500/10 rounded-lg px-2.5 py-2 flex items-center gap-2">
                    <Rocket className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Etapa Growth</p>
                      <p className="text-sm font-semibold text-teal-700 dark:text-teal-400 truncate">{stepLabel}</p>
                    </div>
                  </div>
                )}

                {client.onboarding_started_at && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    Início {formatDistanceToNow(new Date(client.onboarding_started_at), { addSuffix: true, locale: ptBR })}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CSColumnScroll>
    </div>
  );
}
