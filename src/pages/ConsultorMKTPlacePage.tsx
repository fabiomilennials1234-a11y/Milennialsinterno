import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  UserPlus, CheckSquare, ChevronLeft, ChevronRight, Eye,
  Users, FileText, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import DepartmentJustificativaSection from '@/components/department/DepartmentJustificativaSection';
import MktplaceOnboardingSection from '@/components/mktplace/MktplaceOnboardingSection';
import MktplaceAcompanhamentoSection from '@/components/mktplace/MktplaceAcompanhamentoSection';
import MktplaceDocumentacaoSection from '@/components/mktplace/MktplaceDocumentacaoSection';
import ClientViewModal from '@/components/client/ClientViewModal';
import { useCreateMktplaceInitialTask, isGestaoMktplace, useMktplaceProfiles } from '@/hooks/useMktplaceKanban';

const COLUMNS = [
  { id: 'novo-cliente', title: 'Novos Clientes', icon: UserPlus, headerClass: 'section-header-green', iconColor: 'text-white' },
  { id: 'tarefas-diarias', title: 'Tarefas Diárias', icon: CheckSquare, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
  { id: 'acompanhamento-consultoria', title: 'Acompanhamento Consultoria de MKT Place', icon: Users, headerClass: 'section-header-blue', iconColor: 'text-white' },
  { id: 'acompanhamento-gestao', title: 'Acompanhamento Gestão de MKT Place', icon: Users, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'documentacao', title: 'Documentação Dia', icon: FileText, headerClass: 'section-header-orange', iconColor: 'text-white' },
  { id: 'justificativa', title: 'Justificativa', icon: AlertCircle, headerClass: 'section-header-danger', iconColor: 'text-white' },
];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ==================== Novo Cliente Section (com olhinho) ====================

function MktplaceNovoClienteSection() {
  const { user, isCEO, isAdminUser } = useAuth();
  const createInitialTask = useCreateMktplaceInitialTask();
  const { data: profiles = [] } = useMktplaceProfiles();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['mktplace-new-clients', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, monthly_value, mktplace_status, mktplace_entered_at, assigned_mktplace, assigned_ads_manager, assigned_comercial, assigned_crm')
        .eq('mktplace_status', 'novo')
        .eq('archived', false)
        .not('assigned_mktplace', 'is', null)
        .order('mktplace_entered_at', { ascending: true });

      if (!isCEO && !isAdminUser) {
        query = query.eq('assigned_mktplace', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Auto-create initial tasks for new clients (run once per client set)
  const [tasksCreatedFor, setTasksCreatedFor] = useState<Set<string>>(new Set());
  useEffect(() => {
    const newClients = clients.filter(c => !tasksCreatedFor.has(c.id));
    if (newClients.length === 0) return;

    const ids = new Set(tasksCreatedFor);
    newClients.forEach(client => {
      const name = client.razao_social || client.name || 'Cliente';
      const gestao = isGestaoMktplace(client);
      createInitialTask.mutate({ clientId: client.id, clientName: name, isGestao: gestao });
      ids.add(client.id);
    });
    setTasksCreatedFor(ids);
  }, [clients]);

  const getProfileName = (userId: string | null) => {
    if (!userId) return '—';
    return profiles.find(p => p.user_id === userId)?.name || '—';
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserPlus size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum cliente novo</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {clients.map(client => {
          const name = client.razao_social || client.name || 'Cliente';
          const gestao = isGestaoMktplace(client);
          const label = gestao ? 'Gestão de MKT PLACE' : 'Consultoria de MKT PLACE';
          const labelColor = gestao
            ? 'bg-purple-500/10 text-purple-500 border-purple-500/30'
            : 'bg-blue-500/10 text-blue-500 border-blue-500/30';

          return (
            <Card key={client.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm text-foreground line-clamp-2">{name}</h4>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] gap-1"
                        onClick={() => setSelectedClientId(client.id)}
                      >
                        <Eye size={12} />
                        Ver
                      </Button>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${labelColor}`}>
                    {label}
                  </Badge>
                  {client.monthly_value && (
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(Number(client.monthly_value))}</p>
                  )}
                  {/* Responsáveis */}
                  <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/50">
                    <p><span className="font-medium">Gestor de ADS:</span> {getProfileName(client.assigned_ads_manager)}</p>
                    <p><span className="font-medium">Treinador Comercial:</span> {getProfileName(client.assigned_comercial)}</p>
                    <p><span className="font-medium">Gestor de CRM:</span> {getProfileName(client.assigned_crm)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de visualização do cliente */}
      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen={true}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </>
  );
}

// ==================== Main Page ====================

export default function ConsultorMKTPlacePage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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

  const allowedRoles = ['consultor_mktplace', 'consultor_comercial', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  const renderColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'novo-cliente':
        return <MktplaceNovoClienteSection />;
      case 'tarefas-diarias':
        return <DepartmentTarefasSection department="consultor_mktplace" type="daily" />;
      case 'acompanhamento-consultoria':
        return <MktplaceAcompanhamentoSection trackingType="consultoria" title="Consultoria de MKT Place" />;
      case 'acompanhamento-gestao':
        return <MktplaceAcompanhamentoSection trackingType="gestao" title="Gestão de MKT Place" />;
      case 'documentacao':
        return <MktplaceDocumentacaoSection />;
      case 'justificativa':
        return <DepartmentJustificativaSection department="consultor_mktplace" />;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">Consultor(a) de MKT Place</h1>
          <p className="text-caption text-muted-foreground mt-1">Gestão de consultoria e acompanhamento de MKT Place</p>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {canScrollLeft && (
            <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => {
              scrollContainerRef.current?.scrollBy({ left: -380, behavior: 'smooth' });
            }}>
              <ChevronLeft size={18} className="text-muted-foreground" />
            </Button>
          )}
          {canScrollRight && (
            <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => {
              scrollContainerRef.current?.scrollBy({ left: 380, behavior: 'smooth' });
            }}>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Button>
          )}

          <div ref={scrollContainerRef} className="h-full overflow-x-auto overflow-y-hidden px-8 py-6 scrollbar-apple">
            <div className="flex gap-6 h-full pb-4" style={{ minWidth: 'max-content' }}>
              {/* Colunas fixas primeiro: Novo Cliente e Tarefas */}
              {COLUMNS.slice(0, 2).map(column => {
                const Icon = column.icon;
                return (
                  <div key={column.id} className="w-[340px] h-full flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
                    <div className={`section-header ${column.headerClass}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={column.iconColor} />
                        <h2 className="font-semibold">{column.title}</h2>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-apple bg-card">
                      {renderColumnContent(column.id)}
                    </div>
                  </div>
                );
              })}

              {/* Colunas de Onboarding (renderizadas pelo componente próprio) */}
              <MktplaceOnboardingSection />

              {/* Demais colunas: Acompanhamento, Documentação, Justificativa */}
              {COLUMNS.slice(2).map(column => {
                const Icon = column.icon;
                return (
                  <div key={column.id} className="w-[340px] h-full flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
                    <div className={`section-header ${column.headerClass}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={column.iconColor} />
                        <h2 className="font-semibold text-sm">{column.title}</h2>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-apple bg-card">
                      {renderColumnContent(column.id)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
