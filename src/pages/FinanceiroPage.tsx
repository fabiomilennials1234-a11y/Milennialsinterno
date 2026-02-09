import { useRef, useEffect, useState, Fragment } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { 
  CheckSquare, Users, ChevronLeft, ChevronRight, Wrench, FileText, 
  AlertCircle, UserPlus, Target, Timer, UserCheck, ExternalLink, 
  CalendarClock, Wallet, BarChart3, FileSpreadsheet, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFinanceiroClients } from '@/hooks/useDepartmentManager';
import FinanceiroOverviewDashboard from '@/components/financeiro/FinanceiroOverviewDashboard';
import FinanceiroFerramentasSection from '@/components/financeiro/FinanceiroFerramentasSection';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import DepartmentJustificativaSection from '@/components/department/DepartmentJustificativaSection';
import FinanceiroNovoClienteSection from '@/components/financeiro/FinanceiroNovoClienteSection';
import FinanceiroMarcoSection from '@/components/financeiro/FinanceiroMarcoSection';
import FinanceiroClientesAtivosSection from '@/components/financeiro/FinanceiroClientesAtivosSection';
import FinanceiroClientesAtivosModal from '@/components/financeiro/FinanceiroClientesAtivosModal';
import FinanceiroContratosExpirandoSection from '@/components/financeiro/FinanceiroContratosExpirandoSection';
import FinanceiroDistratosSection from '@/components/financeiro/FinanceiroDistratosSection';
import FinanceiroProductChurnsSection from '@/components/financeiro/FinanceiroProductChurnsSection';
import FinanceiroContasSection from '@/components/financeiro/FinanceiroContasSection';
import FinanceiroDRESection from '@/components/financeiro/FinanceiroDRESection';
import { FinanceiroComissoesSection } from '@/components/financeiro/FinanceiroComissoesSection';

// Colunas do Kanban "Millennials Contratos"
const CONTRATOS_COLUMNS = [
  {
    id: 'overview',
    title: 'Visão Geral',
    icon: Users,
    headerClass: 'section-header-blue',
    iconColor: 'text-white',
    clickable: false
  },
  {
    id: 'tarefas-diarias',
    title: 'Tarefas Diárias',
    icon: CheckSquare,
    headerClass: 'section-header-yellow',
    iconColor: 'text-foreground',
    clickable: false
  },
  {
    id: 'novo-cliente',
    title: 'Novo Cliente',
    icon: UserPlus,
    headerClass: 'section-header-orange',
    iconColor: 'text-white',
    badge: null,
    clickable: false
  },
  {
    id: 'marco1',
    title: '[Marco 1]',
    icon: Target,
    headerClass: 'section-header-blue',
    iconColor: 'text-white',
    badge: 'MAX: 3 Dias',
    clickable: false
  },
  {
    id: 'marco2',
    title: '[Marco 2] Otimizações PRO+',
    icon: Target,
    headerClass: 'section-header-green',
    iconColor: 'text-white',
    badge: 'MAX: 10 Dias',
    clickable: false
  },
  {
    id: 'clientes-ativos',
    title: 'Clientes',
    icon: UserCheck,
    headerClass: 'section-header-green',
    iconColor: 'text-white',
    badge: null,
    clickable: true
  },
  {
    id: 'contratos-expirando',
    title: 'Contratos Expirando',
    icon: CalendarClock,
    headerClass: 'section-header-yellow',
    iconColor: 'text-foreground',
    badge: null,
    clickable: false
  },
  {
    id: 'justificativa',
    title: 'Justificativa',
    icon: AlertCircle,
    headerClass: 'section-header-danger',
    iconColor: 'text-white',
    badge: null,
    clickable: false
  },
  {
    id: 'ferramentas',
    title: 'Ferramentas PRO+',
    icon: Wrench,
    headerClass: 'section-header-purple',
    iconColor: 'text-white',
    badge: null,
    clickable: false
  }
];

// Colunas do Kanban "Millennials Contas a Pagar e Receber"
const CONTAS_COLUMNS = [
  {
    id: 'contas',
    title: 'Contas',
    icon: Wallet,
    headerClass: 'section-header-blue',
    iconColor: 'text-white',
    badge: null,
    clickable: false
  },
  {
    id: 'comissoes',
    title: 'Comissões',
    icon: TrendingUp,
    headerClass: 'section-header-green',
    iconColor: 'text-white',
    badge: null,
    clickable: false
  },
  {
    id: 'dre',
    title: 'DRE',
    icon: BarChart3,
    headerClass: 'section-header-purple',
    iconColor: 'text-white',
    badge: null,
    clickable: false
  },
];

export default function FinanceiroPage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const contratosScrollRef = useRef<HTMLDivElement>(null);
  const contasScrollRef = useRef<HTMLDivElement>(null);
  const activeTab = searchParams.get('tab') || 'contratos';
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isClientesAtivosModalOpen, setIsClientesAtivosModalOpen] = useState(false);
  
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };
  
  const { data: clients = [], isLoading: clientsLoading } = useFinanceiroClients();
  
  const allowedRoles = ['financeiro', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  const checkScrollButtons = () => {
    const container = activeTab === 'contratos' ? contratosScrollRef.current : contasScrollRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };

  useEffect(() => {
    const container = activeTab === 'contratos' ? contratosScrollRef.current : contasScrollRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      checkScrollButtons();
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, [activeTab]);

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  const scroll = (direction: 'left' | 'right') => {
    const container = activeTab === 'contratos' ? contratosScrollRef.current : contasScrollRef.current;
    if (container) {
      const scrollAmount = 380;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const renderContratosColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'overview':
        return <FinanceiroOverviewDashboard />;
      case 'tarefas-diarias':
        return <DepartmentTarefasSection department="financeiro" type="daily" />;
      case 'novo-cliente':
        return <FinanceiroNovoClienteSection />;
      case 'marco1':
        return <FinanceiroMarcoSection marcoId="marco1" />;
      case 'marco2':
        return <FinanceiroMarcoSection marcoId="marco2" />;
      case 'clientes-ativos':
        return <FinanceiroClientesAtivosSection />;
      case 'contratos-expirando':
        return <FinanceiroContratosExpirandoSection />;
      case 'justificativa':
        return <DepartmentJustificativaSection department="financeiro" />;
      case 'ferramentas':
        return <FinanceiroFerramentasSection />;
      default:
        return null;
    }
  };

  const renderContasColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'contas':
        return <FinanceiroContasSection />;
      case 'comissoes':
        return <FinanceiroComissoesSection />;
      case 'dre':
        return <FinanceiroDRESection />;
      default:
        return null;
    }
  };

  const renderKanbanBoard = (
    columns: typeof CONTRATOS_COLUMNS, 
    scrollRef: React.RefObject<HTMLDivElement>,
    renderContent: (columnId: string) => React.ReactNode,
    includeDistratos?: boolean
  ) => (
    <div className="flex-1 relative overflow-hidden">
      {/* Scroll Buttons */}
      {canScrollLeft && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" 
          onClick={() => scroll('left')}
        >
          <ChevronLeft size={18} className="text-muted-foreground" />
        </Button>
      )}
      {canScrollRight && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" 
          onClick={() => scroll('right')}
        >
          <ChevronRight size={18} className="text-muted-foreground" />
        </Button>
      )}

      {/* Scrollable Container */}
      <div ref={scrollRef} className="h-full overflow-x-auto overflow-y-hidden px-8 py-6 scrollbar-apple">
        <div className="flex gap-6 h-full pb-4" style={{ minWidth: 'max-content' }}>
          {columns.map((column) => {
            const Icon = column.icon;
            const isBeforeFerramentas = column.id === 'ferramentas' && includeDistratos;
            
            return (
              <Fragment key={column.id}>
                {/* Render Distratos section before Ferramentas */}
                {isBeforeFerramentas && (
                  <div className="flex-shrink-0">
                    <FinanceiroDistratosSection />
                  </div>
                )}
                
                <div className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
                  <div 
                    className={`section-header ${column.headerClass} ${column.clickable ? 'cursor-pointer hover:brightness-110 transition-all group relative' : ''}`} 
                    onClick={() => {
                      if (column.id === 'clientes-ativos') {
                        setIsClientesAtivosModalOpen(true);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={column.iconColor} />
                        <h2 className={`font-semibold ${column.clickable ? 'group-hover:underline underline-offset-2' : ''}`}>
                          {column.title}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        {column.badge && (
                          <Badge variant="outline" className="bg-white/20 border-white/30 text-white text-xs">
                            <Timer size={12} className="mr-1" />
                            {column.badge}
                          </Badge>
                        )}
                        {column.clickable && (
                          <Badge className="bg-white/30 hover:bg-white/40 text-white text-xs border-0 gap-1 animate-pulse">
                            <ExternalLink size={10} />
                            Gerenciar
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 scrollbar-apple bg-card">
                    {renderContent(column.id)}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">
            {activeTab === 'contratos' ? 'Millennials Contratos' : 'Contas a Pagar e Receber'}
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            {activeTab === 'contratos' 
              ? 'Gestão de contratos e onboarding de clientes'
              : 'Contas a pagar, receber e DRE'
            }
          </p>
        </div>

        {/* Kanban Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'contratos' 
            ? renderKanbanBoard(CONTRATOS_COLUMNS, contratosScrollRef, renderContratosColumnContent, true)
            : renderKanbanBoard(CONTAS_COLUMNS, contasScrollRef, renderContasColumnContent, false)
          }
        </div>

        {/* Modal de Clientes Ativos */}
        <FinanceiroClientesAtivosModal 
          open={isClientesAtivosModalOpen} 
          onOpenChange={setIsClientesAtivosModalOpen} 
        />
      </div>
    </MainLayout>
  );
}
