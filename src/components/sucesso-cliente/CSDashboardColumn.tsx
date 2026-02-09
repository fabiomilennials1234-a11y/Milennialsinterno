import { CSClient, AdsManager } from '@/hooks/useSucessoCliente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CSColumnScroll from './CSColumnScroll';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Users, 
  AlertTriangle, 
  AlertCircle, 
  TrendingUp,
  Clock,
  CheckCircle,
  Activity,
  Phone,
} from 'lucide-react';

interface CSDashboardColumnProps {
  clients: CSClient[];
  managers: AdsManager[];
}

export default function CSDashboardColumn({ clients, managers }: CSDashboardColumnProps) {
  // Calculate metrics
  const totalClients = clients.length;
  const normalClients = clients.filter(c => c.cs_classification === 'normal' || !c.cs_classification).length;
  const alertClients = clients.filter(c => c.cs_classification === 'alerta').length;
  const criticalClients = clients.filter(c => c.cs_classification === 'critico').length;
  const closedClients = clients.filter(c => c.cs_classification === 'encerrado').length;

  // Clients without contact in 7+ days
  const noContactClients = clients.filter(c => {
    if (!c.last_cs_contact_at) return true;
    const daysSince = Math.floor((Date.now() - new Date(c.last_cs_contact_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= 7;
  }).length;

  // Clients contacted today
  const contactedToday = clients.filter(c => {
    if (!c.last_cs_contact_at) return false;
    const contactDate = new Date(c.last_cs_contact_at);
    const today = new Date();
    return contactDate.toDateString() === today.toDateString();
  }).length;

  // Clients per manager with metrics
  const clientsPerManager = managers.map(manager => {
    const managerClients = clients.filter(c => c.assigned_ads_manager === manager.user_id);
    return {
      manager,
      total: managerClients.length,
      normal: managerClients.filter(c => (c.cs_classification || 'normal') === 'normal').length,
      alert: managerClients.filter(c => c.cs_classification === 'alerta').length,
      critical: managerClients.filter(c => c.cs_classification === 'critico').length,
    };
  }).sort((a, b) => (b.alert + b.critical) - (a.alert + a.critical));

  // Health score (percentage of normal clients)
  const healthScore = totalClients > 0 
    ? Math.round((normalClients / totalClients) * 100) 
    : 100;

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle shadow-apple">
      {/* Header */}
      <div className="section-header section-header-purple">
        <div className="flex items-center gap-3">
          <BarChart3 size={18} className="text-white" />
          <h2 className="font-semibold text-white">Dashboards CS</h2>
        </div>
      </div>

      {/* Dashboard content */}
      <CSColumnScroll contentClassName="p-4 space-y-4">
          {/* Health Score */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Score de Saúde</span>
                </div>
                <span className={`text-3xl font-bold ${getHealthColor(healthScore)}`}>
                  {healthScore}%
                </span>
              </div>
              <Progress value={healthScore} className={`h-2 ${getHealthBg(healthScore)}`} />
              <p className="text-xs text-muted-foreground mt-2">
                {normalClients} de {totalClients} clientes em situação normal
              </p>
            </CardContent>
          </Card>

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-muted/30 border-muted">
              <CardContent className="p-3 text-center">
                <Users className="h-5 w-5 mx-auto text-info mb-1" />
                <p className="text-2xl font-bold">{totalClients}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="bg-success/5 border-success/20">
              <CardContent className="p-3 text-center">
                <CheckCircle className="h-5 w-5 mx-auto text-success mb-1" />
                <p className="text-2xl font-bold text-success">{normalClients}</p>
                <p className="text-xs text-muted-foreground">Normais</p>
              </CardContent>
            </Card>
            <Card className="bg-warning/5 border-warning/20">
              <CardContent className="p-3 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto text-warning mb-1" />
                <p className="text-2xl font-bold text-warning">{alertClients}</p>
                <p className="text-xs text-muted-foreground">Em Alerta</p>
              </CardContent>
            </Card>
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-3 text-center">
                <AlertCircle className="h-5 w-5 mx-auto text-destructive mb-1" />
                <p className="text-2xl font-bold text-destructive">{criticalClients}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </CardContent>
            </Card>
          </div>

          {/* Contact metrics */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-info/5 border-info/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="h-4 w-4 text-info" />
                  <span className="text-xs text-muted-foreground">Contatados Hoje</span>
                </div>
                <p className="text-xl font-bold text-info">{contactedToday}</p>
              </CardContent>
            </Card>
            <Card className={`${noContactClients > 0 ? 'bg-warning/5 border-warning/20' : 'bg-muted/30'}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="text-xs text-muted-foreground">Sem contato 7d+</span>
                </div>
                <p className={`text-xl font-bold ${noContactClients > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {noContactClients}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Per manager breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Por Gestor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {clientsPerManager.map(({ manager, total, normal, alert, critical }) => (
                <div 
                  key={manager.user_id}
                  className="flex items-center justify-between py-2 border-b border-subtle last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{manager.name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div 
                        className="h-1.5 bg-success rounded-full" 
                        style={{ width: `${(normal / Math.max(total, 1)) * 60}px` }}
                      />
                      <div 
                        className="h-1.5 bg-warning rounded-full" 
                        style={{ width: `${(alert / Math.max(total, 1)) * 60}px` }}
                      />
                      <div 
                        className="h-1.5 bg-destructive rounded-full" 
                        style={{ width: `${(critical / Math.max(total, 1)) * 60}px` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {total}
                    </Badge>
                    {alert > 0 && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs h-5 px-1.5">
                        {alert}
                      </Badge>
                    )}
                    {critical > 0 && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs h-5 px-1.5">
                        {critical}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Unassigned clients */}
              {clients.filter(c => !c.assigned_ads_manager).length > 0 && (
                <div className="flex items-center justify-between py-2 text-muted-foreground">
                  <span className="text-sm italic">Sem gestor</span>
                  <Badge variant="outline" className="text-xs h-5 px-1.5">
                    {clients.filter(c => !c.assigned_ads_manager).length}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
      </CSColumnScroll>
    </div>
  );
}
