import { useRef, useEffect, useState, useMemo } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { ChevronLeft, ChevronRight, Loader2, LayoutGrid, ListTodo, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAdsManagers, useCSClientsByManager, useCSPermissions, CSClient } from '@/hooks/useSucessoCliente';
import CSManagerColumn from '@/components/sucesso-cliente/CSManagerColumn';
import CSClassificationColumn from '@/components/sucesso-cliente/CSClassificationColumn';
import CSActionManualsColumn from '@/components/sucesso-cliente/CSActionManualsColumn';
import CSExitReasonsColumn from '@/components/sucesso-cliente/CSExitReasonsColumn';
import CSDashboardColumn from '@/components/sucesso-cliente/CSDashboardColumn';
import CSHeaderStats from '@/components/sucesso-cliente/CSHeaderStats';
import CSComercialColumn from '@/components/sucesso-cliente/CSComercialColumn';
import CSNPSSection from '@/components/sucesso-cliente/CSNPSSection';
import ClientViewModal from '@/components/client/ClientViewModal';
import CSClientDetailModal from '@/components/sucesso-cliente/CSClientDetailModal';
import CXValidationPopup from '@/components/sucesso-cliente/CXValidationPopup';
import CSPendenciaCXColumn from '@/components/sucesso-cliente/CSPendenciaCXColumn';
import { useCXPendingClients } from '@/hooks/useCXValidation';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import DepartmentTasksTab from '@/components/department/DepartmentTasksTab';

export default function SucessoClientePage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeView, setActiveView] = useState<'kanban' | 'tarefas'>('kanban');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedCSClient, setSelectedCSClient] = useState<CSClient | null>(null);
  const {
    data: managers = [],
    isLoading: managersLoading
  } = useAdsManagers();
  const {
    data: clients = [],
    isLoading: clientsLoading
  } = useCSClientsByManager();
  const {
    canViewDashboards,
    isViewOnly
  } = useCSPermissions();

  // CX Validation: buscar clientes pendentes e controlar popup obrigatório
  const { data: cxPendingClients = [] } = useCXPendingClients();
  const cxAguardando = useMemo(() => cxPendingClients.filter(c => c.cx_validation_status === 'aguardando_validacao'), [cxPendingClients]);
  const [cxPopupDismissed, setCxPopupDismissed] = useState<Set<string>>(new Set());

  // Primeiro cliente aguardando que ainda não foi respondido nesta sessão
  const cxCurrentClient = useMemo(() => {
    return cxAguardando.find(c => !cxPopupDismissed.has(c.id)) || null;
  }, [cxAguardando, cxPopupDismissed]);

  const handleCxPopupClose = () => {
    if (cxCurrentClient) {
      setCxPopupDismissed(prev => new Set(prev).add(cxCurrentClient.id));
    }
  };

  // Helper to check if client is in churn/closed state
  const isClientClosed = (client: CSClient) => {
    return client.cs_classification === 'encerrado' || 
           client.status === 'churned' || 
           !!client.distrato_step;
  };

  // Group clients by manager - exclude closed/churned clients
  const clientsByManager = useMemo(() => {
    const map = new Map<string, CSClient[]>();
    managers.forEach(m => map.set(m.user_id, []));
    clients.forEach(client => {
      // Exclude closed/churned clients from manager columns
      if (isClientClosed(client)) return;
      
      if (client.assigned_ads_manager && map.has(client.assigned_ads_manager)) {
        map.get(client.assigned_ads_manager)!.push(client);
      }
    });
    return map;
  }, [clients, managers]);

  // Filter clients by classification - exclude closed clients from alert/critical
  const alertClients = useMemo(() => clients.filter(c => c.cs_classification === 'alerta' && !isClientClosed(c)), [clients]);
  const criticalClients = useMemo(() => clients.filter(c => c.cs_classification === 'critico' && !isClientClosed(c)), [clients]);
  const closedClients = useMemo(() => clients.filter(c => isClientClosed(c)), [clients]);

  // Scroll handling - must define checkScrollButtons before useEffect
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      checkScrollButtons();
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, []);
  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 380;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  // Handler for manager columns - opens full ClientViewModal
  const handleClientClick = (client: CSClient) => {
    setSelectedClientId(client.id);
  };

  // Handler for classification columns (alerta, critico, encerrado) - opens CSClientDetailModal with ActionPlans
  const handleCSClientClick = (client: CSClient) => {
    setSelectedCSClient(client);
  };
  const isLoading = managersLoading || clientsLoading;

  return <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="px-8 py-5 border-b border-subtle shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-display text-foreground">Sucesso do Cliente</h1>
              <p className="text-caption text-muted-foreground mt-1">
                Central de relacionamento e sucesso dos clientes
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isViewOnly && <div className="bg-muted px-3 py-1.5 rounded-full">
                  <span className="text-xs text-muted-foreground">Modo visualização</span>
                </div>}
            </div>
          </div>
          
          {/* Stats bar */}
          {!isLoading && <div className="mt-4">
              <CSHeaderStats clients={clients} managers={managers} />
            </div>}

          {/* View toggle */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mt-4 w-fit">
            <button
              onClick={() => setActiveView('kanban')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all',
                activeView === 'kanban'
                  ? 'bg-card shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid size={16} />
              Kanban
            </button>
            <button
              onClick={() => setActiveView('tarefas')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all',
                activeView === 'tarefas'
                  ? 'bg-card shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ListTodo size={16} />
              Tarefas
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading ? <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div> : activeView === 'tarefas' ? (
          <DepartmentTasksTab department="sucesso_cliente" />
        ) : (/* Board Container */
      <div className="flex-1 relative overflow-hidden">
            {/* Scroll Buttons */}
            {canScrollLeft && <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => scroll('left')}>
                <ChevronLeft size={18} className="text-muted-foreground" />
              </Button>}
            {canScrollRight && <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => scroll('right')}>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Button>}

            {/* Scrollable Container */}
            <div ref={scrollContainerRef} className="h-full overflow-x-auto overflow-y-hidden px-8 pt-6 pb-4 scrollbar-apple">
              <div className="flex gap-6 h-full pr-12 pt-2" style={{
            minWidth: 'max-content'
          }}>
                {/* Tarefas Recorrentes column */}
                <div className="w-[340px] h-full flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
                  <div className="section-header section-header-green">
                    <div className="flex items-center gap-3">
                      <CheckSquare size={18} className="text-white" />
                      <h2 className="font-semibold text-sm">Tarefas Recorrentes</h2>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 scrollbar-apple bg-card">
                    <DepartmentTarefasSection department="sucesso_cliente" type="daily" />
                  </div>
                </div>

                {/* Manager columns */}
                {managers.map(manager => <CSManagerColumn key={manager.user_id} manager={manager} clients={clientsByManager.get(manager.user_id) || []} onClientClick={handleClientClick} />)}

                {/* Pendência CX column - always visible */}
                <CSPendenciaCXColumn clients={cxPendingClients} />

                {/* Comercial column - right after managers */}
                <CSComercialColumn />

                {/* Alert column - uses CSClientDetailModal */}
                <CSClassificationColumn classification="alerta" clients={alertClients} onClientClick={handleCSClientClick} />

                {/* Critical column - uses CSClientDetailModal */}
                <CSClassificationColumn classification="critico" clients={criticalClients} onClientClick={handleCSClientClick} />

                {/* Closed column - uses CSClientDetailModal */}
                <CSClassificationColumn classification="encerrado" clients={closedClients} onClientClick={handleCSClientClick} />

                {/* Exit Reasons column - replaces Insights */}
                <CSExitReasonsColumn />

                {/* Action Manuals column */}
                <CSActionManualsColumn />

                {/* NPS Survey Section */}
                <CSNPSSection />

                {/* Dashboard column (only for authorized roles) */}
                {canViewDashboards && <CSDashboardColumn clients={clients} managers={managers} />}
              </div>
            </div>
          </div>)}
      </div>

      {/* Client detail modal - for manager columns */}
      {selectedClientId && <ClientViewModal key={selectedClientId} isOpen={true} onClose={() => setSelectedClientId(null)} clientId={selectedClientId} />}
      
      {/* CS Client detail modal - for classification columns with Action Plans */}
      {selectedCSClient && <CSClientDetailModal isOpen={!!selectedCSClient} onClose={() => setSelectedCSClient(null)} client={selectedCSClient} />}

      {/* CX Validation Popup - obrigatório para novos clientes */}
      {cxCurrentClient && (
        <CXValidationPopup
          client={cxCurrentClient}
          isOpen={true}
          onClose={handleCxPopupClose}
        />
      )}
    </MainLayout>;
}
