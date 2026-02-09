import { useState, useMemo } from 'react';
import { CSClient, CSClassification, useClientAlertSuggestions } from '@/hooks/useSucessoCliente';
import { useActiveActionPlansByClients, PROBLEM_TYPES } from '@/hooks/useCSActionPlans';
import CSClientCard from './CSClientCard';
import CSColumnScroll from './CSColumnScroll';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, AlertCircle, XCircle, Search, Users } from 'lucide-react';

interface CSClassificationColumnProps {
  classification: CSClassification;
  clients: CSClient[];
  onClientClick?: (client: CSClient) => void;
}

const COLUMN_CONFIG: Record<CSClassification, { 
  title: string; 
  headerClass: string; 
  icon: React.ElementType;
  iconColor: string;
  emptyMessage: string;
}> = {
  normal: { 
    title: 'Clientes Normais', 
    headerClass: 'section-header-green', 
    icon: Users, 
    iconColor: 'text-white',
    emptyMessage: 'Todos os clientes estão classificados',
  },
  alerta: { 
    title: 'Clientes em Alerta', 
    headerClass: 'section-header-yellow', 
    icon: AlertTriangle, 
    iconColor: 'text-foreground',
    emptyMessage: 'Nenhum cliente em alerta',
  },
  critico: { 
    title: 'Clientes Críticos', 
    headerClass: 'section-header-danger', 
    icon: AlertCircle, 
    iconColor: 'text-white',
    emptyMessage: 'Nenhum cliente crítico',
  },
  encerrado: { 
    title: 'Clientes Encerrados', 
    headerClass: 'section-header-gray', 
    icon: XCircle, 
    iconColor: 'text-white',
    emptyMessage: 'Nenhum cliente encerrado',
  },
};

export default function CSClassificationColumn({ classification, clients, onClientClick }: CSClassificationColumnProps) {
  const [search, setSearch] = useState('');
  
  const config = COLUMN_CONFIG[classification];
  const Icon = config.icon;
  
  const suggestions = useClientAlertSuggestions(clients);
  const suggestionMap = new Map(
    suggestions.map(s => [s.client.id, { suggestedClassification: s.suggestedClassification!, reason: s.reason }])
  );

  // Fetch active action plans for all clients in this column
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: actionPlansMap } = useActiveActionPlansByClients(clientIds);

  // Filter by search
  const filteredClients = clients.filter(client => {
    if (!search) return true;
    return client.name.toLowerCase().includes(search.toLowerCase()) ||
           client.razao_social?.toLowerCase().includes(search.toLowerCase()) ||
           client.niche?.toLowerCase().includes(search.toLowerCase());
  });

  // Sort by days since contact (most urgent first)
  const sortedClients = [...filteredClients].sort((a, b) => {
    const getDays = (c: CSClient) => {
      if (!c.last_cs_contact_at) return 999;
      return Math.floor((Date.now() - new Date(c.last_cs_contact_at).getTime()) / (1000 * 60 * 60 * 24));
    };
    return getDays(b) - getDays(a);
  });

  return (
    <div className="w-[360px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle shadow-apple">
      {/* Header */}
      <div className={`section-header ${config.headerClass}`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Icon size={18} className={config.iconColor} />
            <h2 className="font-semibold">{config.title}</h2>
          </div>
          <Badge 
            variant="secondary" 
            className={`border-0 ${classification === 'alerta' ? 'bg-foreground/20 text-foreground' : 'bg-white/20 text-white'}`}
          >
            {clients.length}
          </Badge>
        </div>
      </div>

      {/* Search */}
      {clients.length > 3 && (
        <div className="px-4 py-3 border-b border-subtle">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Client list */}
      <CSColumnScroll contentClassName="p-4 space-y-3">
          {sortedClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">{search ? 'Nenhum resultado' : config.emptyMessage}</p>
            </div>
          ) : (
            sortedClients.map(client => {
              // Get the active plan for THIS specific client
              const activePlan = actionPlansMap?.get(client.id);
              const activeActionPlan = activePlan ? {
                dueDate: activePlan.due_date,
                severity: activePlan.severity,
                problemLabel: PROBLEM_TYPES[activePlan.problem_type].label,
                status: activePlan.status,
              } : null;

              return (
                <CSClientCard
                  key={client.id}
                  client={client}
                  onClick={() => onClientClick?.(client)}
                  showSuggestion={suggestionMap.get(client.id) || null}
                  activeActionPlan={activeActionPlan}
                />
              );
            })
          )}
      </CSColumnScroll>
    </div>
  );
}
