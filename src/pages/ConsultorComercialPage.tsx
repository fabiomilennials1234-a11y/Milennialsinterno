import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  UserPlus, 
  CheckSquare, 
  Users, 
  Gift,
  Quote,
  ChevronLeft,
  ChevronRight,
  Wrench,
  FileText,
  Calendar,
  CalendarCheck,
  AlertCircle,
  UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Componentes do Consultor Comercial
import ComercialNovoClienteSection from '@/components/comercial/ComercialNovoClienteSection';
import ComercialConsultoriaMarcadaSection from '@/components/comercial/ComercialConsultoriaMarcadaSection';
import ComercialTarefasSection from '@/components/comercial/ComercialTarefasSection';
import ComercialAcompanhamentoSection from '@/components/comercial/ComercialAcompanhamentoSection';
import ComercialJustificativaSection from '@/components/comercial/ComercialJustificativaSection';
import ComercialDocumentacaoSection from '@/components/comercial/ComercialDocumentacaoSection';
import ComercialChurnSection from '@/components/comercial/ComercialChurnSection';
import ComercialDelayModal from '@/components/comercial/ComercialDelayModal';
import ComercialMovimentacaoNotification from '@/components/comercial/ComercialMovimentacaoNotification';

// Componentes reutilizados do Ads Manager
import AdsFerramentasSection from '@/components/ads-manager/AdsFerramentasSection';
import AdsBonusSection from '@/components/ads-manager/AdsBonusSection';
import AdsLemasSection from '@/components/ads-manager/AdsLemasSection';

// Colunas do Consultor Comercial
const COLUMNS = [
  { id: 'documentacao', title: 'Documentação do Dia', icon: FileText, headerClass: 'section-header-blue', iconColor: 'text-white' },
  { id: 'tarefas-diarias', title: 'Tarefas Diárias', icon: CheckSquare, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
  { id: 'tarefas-semana', title: 'Tarefas da Semana', icon: Calendar, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'novo-cliente', title: 'Novo Cliente', icon: UserPlus, headerClass: 'section-header-green', iconColor: 'text-white' },
  { id: 'consultoria-marcada', title: 'Consultoria Marcada', icon: CalendarCheck, headerClass: 'section-header-orange', iconColor: 'text-white' },
  { id: 'acompanhamento', title: 'Acompanhamento', icon: Users, headerClass: 'section-header-blue', iconColor: 'text-white', fullWidth: true },
  { id: 'justificativa', title: 'Justificativa', icon: AlertCircle, headerClass: 'section-header-danger', iconColor: 'text-white' },
  { id: 'churn', title: 'Churns', icon: UserX, headerClass: 'section-header-danger', iconColor: 'text-white' },
  { id: 'ferramentas', title: 'Ferramentas PRO+', icon: Wrench, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'bonus', title: 'Bônus Millennials', icon: Gift, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
  { id: 'lemas', title: 'Lemas', icon: Quote, headerClass: 'section-header-orange', iconColor: 'text-white' },
];

export default function ConsultorComercialPage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
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

  const allowedRoles = ['consultor_comercial', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);
  
  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 380;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const renderColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'documentacao':
        return <ComercialDocumentacaoSection />;
      case 'tarefas-diarias':
        return <ComercialTarefasSection taskType="daily" />;
      case 'tarefas-semana':
        return <ComercialTarefasSection taskType="weekly" />;
      case 'novo-cliente':
        return <ComercialNovoClienteSection />;
      case 'consultoria-marcada':
        return <ComercialConsultoriaMarcadaSection />;
      case 'acompanhamento':
        return <ComercialAcompanhamentoSection />;
      case 'churn':
        return <ComercialChurnSection />;
      case 'justificativa':
        return <ComercialJustificativaSection />;
      case 'ferramentas':
        return <AdsFerramentasSection />;
      case 'bonus':
        return <AdsBonusSection />;
      case 'lemas':
        return <AdsLemasSection />;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">
            Consultor Comercial
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Central de vendas e acompanhamento comercial
          </p>
        </div>

        {/* Board Container */}
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
          <div
            ref={scrollContainerRef}
            className="h-full overflow-x-auto overflow-y-hidden px-8 py-6 scrollbar-apple"
          >
            <div className="flex gap-6 h-full pb-4" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map((column) => {
                const Icon = column.icon;
                const isFullWidth = column.fullWidth;
                
                return (
                  <div
                    key={column.id}
                    className={`${isFullWidth ? 'w-[600px]' : 'w-[340px]'} flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple`}
                  >
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
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Justificativa de Atraso - Apenas para consultor_comercial */}
      {user?.role === 'consultor_comercial' && <ComercialDelayModal />}
      
      {/* Notificação de Movimentação Pendente - Apenas para consultor_comercial */}
      {user?.role === 'consultor_comercial' && <ComercialMovimentacaoNotification />}
    </MainLayout>
  );
}
