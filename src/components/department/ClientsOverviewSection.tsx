import { DepartmentClient } from '@/hooks/useDepartmentManager';
import { Users, Building2, DollarSign, TrendingUp, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';

interface ClientsOverviewSectionProps {
  clients: DepartmentClient[];
  isLoading: boolean;
  title?: string;
}

export default function ClientsOverviewSection({ 
  clients, 
  isLoading,
  title = "Visão Geral" 
}: ClientsOverviewSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const activeClients = clients.filter(c => !c.archived && c.status !== 'churned');
  const onboardingClients = clients.filter(c => c.status === 'onboarding');
  const publishedClients = clients.filter(c => c.status === 'campaign_published');
  const newClients = clients.filter(c => c.status === 'new_client');

  const stats = [
    {
      label: 'Total Ativos',
      value: activeClients.length,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Novos',
      value: newClients.length,
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Onboarding',
      value: onboardingClients.length,
      icon: Building2,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Campanha Ativa',
      value: publishedClients.length,
      icon: DollarSign,
      color: 'text-info',
      bg: 'bg-info/10',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="p-3 bg-card border border-border rounded-lg"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", stat.bg)}>
                  <Icon size={12} className={stat.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Clients Preview */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Clientes Recentes
        </h4>
        {activeClients.slice(0, 5).map(client => (
          <div
            key={client.id}
            className="p-2 bg-muted/30 rounded-lg"
          >
            {/* Overdue Invoice Badge */}
            <OverdueInvoiceBadge clientId={client.id} className="w-full justify-center mb-1" />
            {/* Contract Status Badge */}
            <ContractStatusBadge clientId={client.id} className="w-full justify-center mb-1" />
            {/* Client Label Badge */}
            {client.client_label && (
              <div className="flex justify-center mb-1">
                <ClientLabelBadge label={client.client_label} size="sm" />
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users size={10} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium truncate max-w-[120px]">{client.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {client.status?.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ClientLabelSelector 
                  clientId={client.id} 
                  currentLabel={client.client_label} 
                />
                {client.expected_investment && (
                  <span className="text-[10px] text-success font-medium">
                    R$ {(client.expected_investment / 1000).toFixed(0)}k
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {activeClients.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-xs">
            Nenhum cliente ativo
          </div>
        )}
      </div>
    </div>
  );
}
