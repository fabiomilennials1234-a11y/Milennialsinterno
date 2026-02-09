import { useState, useMemo } from 'react';
import { AdsManager, CSClient, useClientAlertSuggestions, useCSPermissions } from '@/hooks/useSucessoCliente';
import { useCSOnboardingTasks, useCSClientTracking, CSOnboardingTask, CSClientTracking, isTrackingDelayed, ONBOARDING_STEP_LABELS, DAY_LABELS } from '@/hooks/useCSOnboardingTracking';
import CSClientCard from './CSClientCard';
import CSClientOnboardingBadge from './CSClientOnboardingBadge';
import CSClientTrackingBadge from './CSClientTrackingBadge';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';
import CSColumnScroll from './CSColumnScroll';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Search, 
  Filter, 
  AlertTriangle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Rocket,
  Calendar,
  UserPlus,
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CSManagerColumnProps {
  manager: AdsManager;
  clients: CSClient[];
  onClientClick?: (client: CSClient) => void;
}

export default function CSManagerColumn({ manager, clients, onClientClick }: CSManagerColumnProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterClassification, setFilterClassification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tracking' | 'onboarding' | 'new'>('tracking');
  const [showOnlyDelayed, setShowOnlyDelayed] = useState(false);

  const { canSetLabels } = useCSPermissions();
  
  // Fetch onboarding tasks and tracking for this manager
  const { data: onboardingTasks = [] } = useCSOnboardingTasks(manager.user_id);
  const { data: trackingData = [] } = useCSClientTracking(manager.user_id);
  
  const suggestions = useClientAlertSuggestions(clients);
  
  const suggestionMap = new Map(
    suggestions.map(s => [s.client.id, { suggestedClassification: s.suggestedClassification!, reason: s.reason }])
  );

  // Group onboarding tasks by client
  const tasksByClient = useMemo(() => {
    const map = new Map<string, CSOnboardingTask[]>();
    onboardingTasks.forEach(task => {
      if (!map.has(task.client_id)) {
        map.set(task.client_id, []);
      }
      map.get(task.client_id)!.push(task);
    });
    return map;
  }, [onboardingTasks]);

  // Create tracking map by client
  const trackingByClient = useMemo(() => {
    const map = new Map<string, CSClientTracking>();
    trackingData.forEach(track => {
      map.set(track.client_id, track);
    });
    return map;
  }, [trackingData]);

  // Clients in onboarding (not yet campaign_published)
  const onboardingClients = useMemo(() => 
    clients.filter(c => !c.campaign_published_at && c.onboarding_started_at),
  [clients]);

  // Clients in daily tracking (with tracking data)
  const trackingClients = useMemo(() => 
    clients.filter(c => trackingByClient.has(c.id)),
  [clients, trackingByClient]);

  // Delayed clients (not moved today)
  const delayedClients = useMemo(() => 
    trackingClients.filter(c => {
      const tracking = trackingByClient.get(c.id);
      return tracking && isTrackingDelayed(tracking.last_moved_at);
    }),
  [trackingClients, trackingByClient]);

  // New clients (recent, less than 7 days)
  const newClients = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
   return clients.filter(c => {
     const isRecent = new Date(c.created_at) > sevenDaysAgo;
     const isInOnboarding = !c.campaign_published_at && c.onboarding_started_at;
     const isInTracking = trackingByClient.has(c.id);
     // Only show in "Novos" if recent AND not already in onboarding or tracking
     return isRecent && !isInOnboarding && !isInTracking;
   });
  }, [clients, trackingByClient]);

  // Filter tracking clients
  const filteredTrackingClients = useMemo(() => {
    let filtered = trackingClients;
    
    if (showOnlyDelayed) {
      filtered = delayedClients;
    }
    
    if (search) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.razao_social?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return filtered;
  }, [trackingClients, delayedClients, showOnlyDelayed, search]);

  const alertCount = clients.filter(c => c.cs_classification === 'alerta').length;
  const criticalCount = clients.filter(c => c.cs_classification === 'critico').length;
  const needsAttention = alertCount + criticalCount;

  // Get current step for a client's onboarding
  const getCurrentStep = (clientId: string) => {
    const tasks = tasksByClient.get(clientId) || [];
    const doingTask = tasks.find(t => t.status === 'doing');
    const pendingTask = tasks.find(t => t.status === 'pending');
    const currentTask = doingTask || pendingTask;
    return currentTask ? (ONBOARDING_STEP_LABELS[currentTask.task_type] || currentTask.title) : null;
  };

  // Calculate onboarding progress
  const getOnboardingProgress = (clientId: string) => {
    const tasks = tasksByClient.get(clientId) || [];
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'done').length;
    return Math.round((completed / tasks.length) * 100);
  };

  return (
    <div className="w-[400px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle shadow-apple">
      {/* Header */}
      <div className="section-header section-header-blue">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <User size={18} className="text-white" />
            <h2 className="font-semibold text-white truncate">{manager.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            {delayedClients.length > 0 && (
              <Badge variant="destructive" className="bg-warning text-warning-foreground border-0 text-xs">
                {delayedClients.length} atrasado{delayedClients.length > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {clients.length}
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="px-4 py-2 flex gap-2 border-b border-subtle bg-muted/30 flex-wrap">
        {newClients.length > 0 && (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
            <UserPlus className="h-3 w-3 mr-1" />
            {newClients.length} novo{newClients.length > 1 ? 's' : ''}
          </Badge>
        )}
        {onboardingClients.length > 0 && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
            <Rocket className="h-3 w-3 mr-1" />
            {onboardingClients.length} onboarding
          </Badge>
        )}
        {trackingClients.length > 0 && (
          <Badge variant="outline" className="bg-accent text-accent-foreground border-accent text-xs">
            <Calendar className="h-3 w-3 mr-1" />
            {trackingClients.length} acompanhamento
          </Badge>
        )}
        {criticalCount > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3 border-b border-subtle flex-shrink-0">
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="tracking" className="text-xs gap-1 relative">
              <Calendar className="h-3 w-3" />
              Acompanhamento
              {delayedClients.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-warning text-warning-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {delayedClients.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="text-xs gap-1">
              <Rocket className="h-3 w-3" />
              Onboarding
            </TabsTrigger>
            <TabsTrigger value="new" className="text-xs gap-1">
              <UserPlus className="h-3 w-3" />
              Novos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tracking/Acompanhamento Tab */}
        <TabsContent value="tracking" className="flex-1 min-h-0 m-0 flex flex-col data-[state=inactive]:hidden">
          {/* Delayed filter */}
          {delayedClients.length > 0 && (
            <div className="px-4 py-2 border-b border-subtle">
              <Button
                variant={showOnlyDelayed ? "default" : "outline"}
                size="sm"
                className="w-full h-8 text-xs justify-between"
                onClick={() => setShowOnlyDelayed(!showOnlyDelayed)}
              >
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  {showOnlyDelayed ? 'Mostrando apenas atrasados' : 'Filtrar por atrasados'}
                </span>
                <Badge variant={showOnlyDelayed ? "secondary" : "outline"} className="text-[10px]">
                  {delayedClients.length}
                </Badge>
              </Button>
            </div>
          )}
          
          {/* Search */}
          <div className="px-4 py-2">
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
          
          <CSColumnScroll className="flex-1" contentClassName="px-4 pb-4 space-y-2">
              {filteredTrackingClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="mx-auto mb-2 opacity-50" size={32} />
                  <p className="text-sm">
                    {showOnlyDelayed ? 'Nenhum cliente atrasado' : 'Nenhum cliente em acompanhamento'}
                  </p>
                </div>
              ) : (
                filteredTrackingClients.map(client => {
                  const tracking = trackingByClient.get(client.id);
                  const isDelayed = tracking && isTrackingDelayed(tracking.last_moved_at);
                  
                  return (
                    <div
                      key={client.id}
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                        isDelayed 
                          ? 'bg-warning/5 border-warning/30 hover:bg-warning/10' 
                          : 'bg-muted/30 border-subtle hover:bg-muted/50'
                      }`}
                      onClick={() => onClientClick?.(client)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{client.name}</span>
                          <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canSetLabels && (
                            <ClientLabelSelector
                              clientId={client.id}
                              currentLabel={client.client_label as ClientLabel}
                            />
                          )}
                          {isDelayed && (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] shrink-0">
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              Atrasado
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CSClientTrackingBadge tracking={tracking} />
                    </div>
                  );
                })
              )}
          </CSColumnScroll>
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="flex-1 min-h-0 m-0 flex flex-col data-[state=inactive]:hidden">
          <CSColumnScroll className="flex-1" contentClassName="p-4 space-y-2">
              {onboardingClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Rocket className="mx-auto mb-2 opacity-50" size={32} />
                  <p className="text-sm">Nenhum cliente em onboarding</p>
                </div>
              ) : (
                onboardingClients.map(client => {
                  const clientTasks = tasksByClient.get(client.id) || [];
                  const currentStep = getCurrentStep(client.id);
                  const progress = getOnboardingProgress(client.id);
                  const doingTask = clientTasks.find(t => t.status === 'doing');
                  const isComplete = !!client.campaign_published_at;
                  
                  return (
                    <div
                      key={client.id}
                      className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2.5 cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => onClientClick?.(client)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{client.name}</span>
                          <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canSetLabels && (
                            <ClientLabelSelector
                              clientId={client.id}
                              currentLabel={client.client_label as ClientLabel}
                            />
                          )}
                          <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] shrink-0">
                            {progress}%
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <Progress value={progress} className="h-1.5" />
                      
                      {/* Current step - HIGHLIGHTED */}
                      {currentStep && (
                        <div className="bg-primary/10 rounded-lg px-2.5 py-2">
                          <div className="flex items-center gap-2">
                            {doingTask ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted-foreground">
                                {doingTask ? 'Fazendo agora' : 'Próxima etapa'}
                              </p>
                              <p className="text-sm font-semibold text-primary truncate">
                                {currentStep}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {isComplete && (
                        <div className="bg-success/10 rounded-lg px-2.5 py-2 flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          <span className="text-sm font-medium text-success">Campanha Publicada</span>
                        </div>
                      )}
                      
                      {/* Task count */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{clientTasks.filter(t => t.status === 'done').length} de {clientTasks.length} tarefas</span>
                        {client.onboarding_started_at && (
                          <span>Início {formatDistanceToNow(new Date(client.onboarding_started_at), { addSuffix: true, locale: ptBR })}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
          </CSColumnScroll>
        </TabsContent>

        {/* New Clients Tab */}
        <TabsContent value="new" className="flex-1 min-h-0 m-0 flex flex-col data-[state=inactive]:hidden">
          <CSColumnScroll className="flex-1" contentClassName="p-4 space-y-2">
              {newClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="mx-auto mb-2 opacity-50" size={32} />
                  <p className="text-sm">Nenhum cliente novo nos últimos 7 dias</p>
                </div>
              ) : (
                newClients.map(client => {
                  const tracking = trackingByClient.get(client.id);
                  const clientTasks = tasksByClient.get(client.id) || [];
                  const isInOnboarding = !client.campaign_published_at && client.onboarding_started_at;
                  const isInTracking = !!tracking;
                  
                  return (
                    <div
                      key={client.id}
                      className="p-3 rounded-lg bg-success/5 border border-success/20 space-y-2 cursor-pointer hover:bg-success/10 transition-colors"
                      onClick={() => onClientClick?.(client)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{client.name}</span>
                          <ClientLabelBadge label={client.client_label as ClientLabel} size="sm" />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canSetLabels && (
                            <ClientLabelSelector
                              clientId={client.id}
                              currentLabel={client.client_label as ClientLabel}
                            />
                          )}
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] shrink-0">
                            <UserPlus className="h-2.5 w-2.5 mr-0.5" />
                            Novo
                          </Badge>
                        </div>
                      </div>
                      
                      {client.niche && (
                        <Badge variant="secondary" className="text-[10px]">
                          {client.niche}
                        </Badge>
                      )}
                      
                      {/* Status indicators */}
                      <div className="flex flex-wrap gap-1.5">
                        {isInOnboarding && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                            <Rocket className="h-2.5 w-2.5 mr-0.5" />
                            Onboarding
                          </Badge>
                        )}
                        {isInTracking && (
                          <Badge variant="outline" className="bg-accent text-accent-foreground border-accent text-[10px]">
                            <Calendar className="h-2.5 w-2.5 mr-0.5" />
                            Acompanhamento
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Entrou {formatDistanceToNow(new Date(client.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  );
                })
              )}
          </CSColumnScroll>
        </TabsContent>
      </Tabs>
    </div>
  );
}
