import { CSClient, AdsManager, useCSPermissions } from '@/hooks/useSucessoCliente';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle,
  TrendingUp,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface CSHeaderStatsProps {
  clients: CSClient[];
  managers: AdsManager[];
}

export default function CSHeaderStats({ clients, managers }: CSHeaderStatsProps) {
  const queryClient = useQueryClient();
  const { canViewDashboards } = useCSPermissions();

  const totalClients = clients.length;
  const normalClients = clients.filter(c => (c.cs_classification || 'normal') === 'normal').length;
  const alertClients = clients.filter(c => c.cs_classification === 'alerta').length;
  const criticalClients = clients.filter(c => c.cs_classification === 'critico').length;

  // Clients contacted today
  const contactedToday = clients.filter(c => {
    if (!c.last_cs_contact_at) return false;
    const contactDate = new Date(c.last_cs_contact_at);
    const today = new Date();
    return contactDate.toDateString() === today.toDateString();
  }).length;

  // Health score
  const healthScore = totalClients > 0 
    ? Math.round((normalClients / totalClients) * 100) 
    : 100;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['cs-clients-by-manager'] });
    queryClient.invalidateQueries({ queryKey: ['ads-managers'] });
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Health Score */}
      {canViewDashboards && (
        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full">
          <TrendingUp className={`h-4 w-4 ${healthScore >= 80 ? 'text-success' : healthScore >= 60 ? 'text-warning' : 'text-destructive'}`} />
          <span className="text-sm font-medium">{healthScore}%</span>
          <span className="text-xs text-muted-foreground">Saúde</span>
        </div>
      )}

      {/* Quick stats */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {totalClients} clientes
        </Badge>
        
        {criticalClients > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {criticalClients} críticos
          </Badge>
        )}
        
        {alertClients > 0 && (
          <Badge className="gap-1 bg-warning text-warning-foreground">
            <AlertTriangle className="h-3 w-3" />
            {alertClients} em alerta
          </Badge>
        )}

        {contactedToday > 0 && (
          <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20">
            <Phone className="h-3 w-3" />
            {contactedToday} hoje
          </Badge>
        )}
      </div>

      {/* Refresh button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7"
        onClick={handleRefresh}
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Atualizar
      </Button>
    </div>
  );
}
