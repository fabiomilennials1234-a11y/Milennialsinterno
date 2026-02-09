import { useState, useMemo } from 'react';
import { useComercialConsultants, useCSComercialClients, useCSComercialTracking, useCSComercialTasks, COMERCIAL_STATUS_LABELS, DAY_LABELS, isTrackingDelayed } from '@/hooks/useCSOnboardingTracking';
import CSColumnScroll from './CSColumnScroll';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  User, 
  Search, 
  UserPlus, 
  Calendar,
  CalendarCheck,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Phone,
  Loader2
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { icon: typeof UserPlus; label: string; shortLabel: string; color: string; bgColor: string; step: number }> = {
  'novo': { icon: UserPlus, label: 'Novo Cliente', shortLabel: 'Novo', color: 'text-green-600', bgColor: 'bg-green-500/10', step: 1 },
  'consultoria_marcada': { icon: CalendarCheck, label: 'Consultoria Marcada', shortLabel: 'Marcada', color: 'text-orange-600', bgColor: 'bg-orange-500/10', step: 2 },
  'consultoria_realizada': { icon: CheckCircle2, label: 'Consultoria Realizada', shortLabel: 'Realizada', color: 'text-blue-600', bgColor: 'bg-blue-500/10', step: 3 },
  'em_acompanhamento': { icon: Users, label: 'Em Acompanhamento', shortLabel: 'Acomp.', color: 'text-purple-600', bgColor: 'bg-purple-500/10', step: 4 },
};

const TASK_CONFIG: Record<string, { label: string; shortLabel: string; icon: typeof Phone }> = {
  'marcar_consultoria': { label: 'Marcar Consultoria', shortLabel: 'Marcar', icon: CalendarCheck },
  'realizar_consultoria': { label: 'Realizar Consultoria', shortLabel: 'Realizar', icon: Phone },
};

const ONBOARDING_STEPS = ['novo', 'consultoria_marcada', 'consultoria_realizada', 'em_acompanhamento'];
const DAYS_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

const DAY_FULL_LABELS: Record<string, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
};

export default function CSComercialColumn() {
  const [search, setSearch] = useState('');
  const [expandedConsultants, setExpandedConsultants] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'onboarding' | 'tracking'>('onboarding');

  const { data: consultants = [], isLoading: consultantsLoading } = useComercialConsultants();
  const { data: clients = [], isLoading: clientsLoading } = useCSComercialClients();
  const { data: trackingData = [], isLoading: trackingLoading } = useCSComercialTracking();
  const { data: pendingTasks, isLoading: tasksLoading } = useCSComercialTasks();

  const isLoading = consultantsLoading || clientsLoading || trackingLoading || tasksLoading;

  // Group clients by consultant
  const clientsByConsultant = useMemo(() => {
    const map = new Map<string, typeof clients>();
    consultants.forEach(c => map.set(c.user_id, []));
    
    clients.forEach(client => {
      if (client.assigned_comercial && map.has(client.assigned_comercial)) {
        map.get(client.assigned_comercial)!.push(client);
      }
    });
    
    return map;
  }, [clients, consultants]);

  // Group tracking by consultant
  const trackingByConsultant = useMemo(() => {
    const map = new Map<string, typeof trackingData>();
    consultants.forEach(c => map.set(c.user_id, []));
    
    trackingData.forEach(track => {
      if (map.has(track.comercial_user_id)) {
        map.get(track.comercial_user_id)!.push(track);
      }
    });
    
    return map;
  }, [trackingData, consultants]);

  // Filter clients by search
  const filterBySearch = (clientList: typeof clients) => {
    if (!search) return clientList;
    return clientList.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.razao_social?.toLowerCase().includes(search.toLowerCase())
    );
  };

  const toggleConsultant = (consultantId: string) => {
    setExpandedConsultants(prev => 
      prev.includes(consultantId) 
        ? prev.filter(id => id !== consultantId)
        : [...prev, consultantId]
    );
  };

  // Stats
  const newClients = clients.filter(c => c.comercial_status === 'novo').length;
  const inOnboarding = clients.filter(c => ['consultoria_marcada', 'consultoria_realizada'].includes(c.comercial_status || '')).length;
  const inTracking = trackingData.length;
  const delayedTracking = trackingData.filter(t => isTrackingDelayed(t.last_moved_at)).length;

  return (
    <div className="w-[420px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle shadow-apple">
      {/* Header */}
      <div className="section-header section-header-orange">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <User size={18} className="text-white" />
            <h2 className="font-semibold text-white">Consultor Comercial</h2>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-0">
            {consultants.length}
          </Badge>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-2 flex gap-2 border-b border-subtle bg-muted/30 flex-wrap">
        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
          <UserPlus className="h-3 w-3 mr-1" />
          {newClients} novos
        </Badge>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
          <CalendarCheck className="h-3 w-3 mr-1" />
          {inOnboarding} onboarding
        </Badge>
        <Badge variant="outline" className="bg-accent text-accent-foreground border-accent text-xs">
          <Calendar className="h-3 w-3 mr-1" />
          {inTracking} tracking
        </Badge>
        {delayedTracking > 0 && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {delayedTracking} atrasados
          </Badge>
        )}
      </div>

      {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-3">
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="onboarding" className="text-xs gap-1">
              <CalendarCheck className="h-3 w-3" />
              Onboarding
            </TabsTrigger>
            <TabsTrigger value="tracking" className="text-xs gap-1">
              <Calendar className="h-3 w-3" />
              Acompanhamento
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
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

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="flex-1 overflow-hidden m-0">
          <CSColumnScroll contentClassName="px-4 pb-4 space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Carregando...
                </div>
              ) : consultants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum consultor comercial encontrado
                </div>
              ) : (
                consultants.map(consultant => {
                  const consultantClients = filterBySearch(clientsByConsultant.get(consultant.user_id) || []);
                  const onboardingClients = consultantClients.filter(c => 
                    ['novo', 'consultoria_marcada', 'consultoria_realizada'].includes(c.comercial_status || '')
                  );
                  const isExpanded = expandedConsultants.includes(consultant.user_id);

                  if (onboardingClients.length === 0 && search) return null;

                  return (
                    <Collapsible
                      key={consultant.user_id}
                      open={isExpanded}
                      onOpenChange={() => toggleConsultant(consultant.user_id)}
                    >
                      <Card className="overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="w-full justify-between p-3 h-auto hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-orange-600" />
                              </div>
                              <span className="font-medium text-sm">{consultant.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {onboardingClients.length}
                              </Badge>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </Button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-2">
                            {onboardingClients.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                Nenhum cliente em onboarding
                              </p>
                            ) : (
                              onboardingClients.map(client => {
                                const status = client.comercial_status || 'novo';
                                const config = STATUS_CONFIG[status] || STATUS_CONFIG['novo'];
                                const Icon = config.icon;
                                const stepIndex = ONBOARDING_STEPS.indexOf(status);
                                
                                // Get pending task for this client
                                const pendingTask = pendingTasks?.get(client.id);
                                const taskConfig = pendingTask?.taskType ? TASK_CONFIG[pendingTask.taskType] : null;

                                return (
                                  <div 
                                    key={client.id}
                                    className="p-2.5 rounded-lg border border-subtle bg-muted/30 space-y-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium truncate">{client.name}</span>
                                    </div>
                                    
                                    {/* Pending Task Badge - HIGHLIGHTED */}
                                    {taskConfig && (
                                      <div className="bg-primary/10 border border-primary/30 rounded-lg px-2.5 py-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold text-primary block">
                                              Pendente: {taskConfig.label}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Onboarding progress steps */}
                                    <div className="flex gap-0.5">
                                      {ONBOARDING_STEPS.slice(0, 3).map((step, index) => {
                                        const isCurrent = step === status;
                                        const isPast = index < stepIndex;
                                        const stepConfig = STATUS_CONFIG[step];
                                        
                                        return (
                                          <TooltipProvider key={step}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div className="flex-1 flex flex-col items-center gap-0.5">
                                                  <div
                                                    className={`w-full h-1.5 rounded-full transition-colors ${
                                                      isCurrent 
                                                        ? stepConfig.bgColor.replace('/10', '')
                                                        : isPast 
                                                          ? 'bg-success' 
                                                          : 'bg-muted'
                                                    }`}
                                                  />
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p className="text-xs">{stepConfig.label}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      })}
                                    </div>
                                    
                                    {/* Current status badge */}
                                    <div className={`${config.bgColor} rounded px-2 py-1.5`}>
                                      <div className="flex items-center gap-1.5">
                                        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                                      </div>
                                    </div>
                                    
                                    {client.comercial_entered_at && (
                                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5" />
                                        Entrou {formatDistanceToNow(new Date(client.comercial_entered_at), { addSuffix: true, locale: ptBR })}
                                      </p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
          </CSColumnScroll>
        </TabsContent>

        {/* Tracking Tab */}
        <TabsContent value="tracking" className="flex-1 overflow-hidden m-0">
          <CSColumnScroll contentClassName="px-4 pb-4 space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Carregando...
                </div>
              ) : consultants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum consultor comercial encontrado
                </div>
              ) : (
                consultants.map(consultant => {
                  const consultantTracking = trackingByConsultant.get(consultant.user_id) || [];
                  const isExpanded = expandedConsultants.includes(consultant.user_id);
                  const delayedCount = consultantTracking.filter(t => isTrackingDelayed(t.last_moved_at)).length;

                  if (consultantTracking.length === 0 && search) return null;

                  return (
                    <Collapsible
                      key={consultant.user_id}
                      open={isExpanded}
                      onOpenChange={() => toggleConsultant(consultant.user_id)}
                    >
                      <Card className="overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="w-full justify-between p-3 h-auto hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                                <Calendar className="h-4 w-4 text-accent-foreground" />
                              </div>
                              <span className="font-medium text-sm">{consultant.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {delayedCount > 0 && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                  {delayedCount}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {consultantTracking.length}
                              </Badge>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </Button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-2">
                            {consultantTracking.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                Nenhum cliente em acompanhamento
                              </p>
                            ) : (
                              consultantTracking.map(track => {
                                const isDelayed = isTrackingDelayed(track.last_moved_at);
                                const dayIndex = DAYS_ORDER.indexOf(track.current_day);

                                return (
                                  <div 
                                    key={track.id}
                                    className={`p-2.5 rounded-lg border space-y-2 ${isDelayed ? 'bg-warning/5 border-warning/20' : 'bg-accent/30 border-accent'}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium truncate">{track.manager_name}</span>
                                      {isDelayed && (
                                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                                          <AlertTriangle className="h-2.5 w-2.5" />
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {/* Day progress with labels */}
                                    <div className="flex gap-0.5">
                                      {DAYS_ORDER.map((day, index) => {
                                        const isCurrent = day === track.current_day;
                                        const isPast = index < dayIndex;
                                        
                                        return (
                                          <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                                            <div
                                              className={`w-full h-2 rounded-full transition-colors ${
                                                isCurrent 
                                                  ? (isDelayed ? 'bg-warning' : 'bg-primary')
                                                  : isPast 
                                                    ? 'bg-success' 
                                                    : 'bg-muted'
                                              }`}
                                            />
                                            <span className={`text-[9px] ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                                              {DAY_LABELS[day]}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    {/* Current day badge */}
                                    <div className={`rounded px-2 py-1 ${isDelayed ? 'bg-warning/10' : 'bg-primary/10'}`}>
                                      <div className="flex items-center justify-between">
                                        <span className={`text-xs font-medium ${isDelayed ? 'text-warning' : 'text-primary'}`}>
                                          {DAY_FULL_LABELS[track.current_day]}
                                        </span>
                                        {track.last_moved_at && (
                                          <span className="text-[10px] text-muted-foreground">
                                            {formatDistanceToNow(new Date(track.last_moved_at), { addSuffix: true, locale: ptBR })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
          </CSColumnScroll>
        </TabsContent>
      </Tabs>
    </div>
  );
}
