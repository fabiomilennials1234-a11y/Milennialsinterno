import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { OutboundManagerProvider } from '@/contexts/OutboundManagerContext';
import { Navigate } from 'react-router-dom';
import {
  Calendar,
  FileText,
  CheckSquare,
  Users,
  AlertCircle,
  UserPlus,
  Flag,
  ChevronLeft,
  ChevronRight,
  UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import OutboundReunioesSection from '@/components/outbound-manager/OutboundReunioesSection';
import OutboundDocumentacaoSection from '@/components/outbound-manager/OutboundDocumentacaoSection';
import OutboundTarefasSection from '@/components/outbound-manager/OutboundTarefasSection';
import OutboundAcompanhamentoSection from '@/components/outbound-manager/OutboundAcompanhamentoSection';
import OutboundJustificativaSection from '@/components/outbound-manager/OutboundJustificativaSection';
import OutboundNovoClienteSection from '@/components/outbound-manager/OutboundNovoClienteSection';
import OutboundOnboardingSection from '@/components/outbound-manager/OutboundOnboardingSection';
import OutboundChurnSection from '@/components/outbound-manager/OutboundChurnSection';
import OutboundMovimentacaoNotification from '@/components/outbound-manager/OutboundMovimentacaoNotification';
import { getRolesAllowedForPath } from '@/types/auth';

// Cores vibrantes para cada seção - Ordem definida pelo usuário
const COLUMNS = [
  { id: 'reunioes', title: 'Reuniões', icon: Calendar, headerClass: 'section-header-blue', iconColor: 'text-white' },
  { id: 'documentacao', title: 'Documentação', icon: FileText, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'tarefas-diarias', title: 'Tarefas Diárias', icon: CheckSquare, headerClass: 'section-header-green', iconColor: 'text-white' },
  { id: 'tarefas-semanais', title: 'Tarefas Semanais', icon: CheckSquare, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
  { id: 'acompanhamento', title: 'Acompanhamento', icon: Users, headerClass: 'section-header-orange', iconColor: 'text-white' },
  { id: 'justificativa', title: 'Justificativa', icon: AlertCircle, headerClass: 'section-header-danger', iconColor: 'text-white' },
  { id: 'novo-cliente', title: 'Novo Cliente', icon: UserPlus, headerClass: 'section-header-green', iconColor: 'text-white' },
  { id: 'churn', title: 'Churns', icon: UserX, headerClass: 'section-header-danger', iconColor: 'text-white' },
];

const ONBOARDING_SECTION = { id: 'onboarding', title: 'Onboarding', icon: Flag, headerClass: 'section-header-yellow', iconColor: 'text-foreground' };

export default function OutboundManagerPage() {
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

  const allowedRoles = getRolesAllowedForPath('/millennials-outbound');
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
      case 'reunioes':
        return <OutboundReunioesSection />;
      case 'documentacao':
        return <OutboundDocumentacaoSection />;
      case 'tarefas-diarias':
        return <OutboundTarefasSection type="daily" />;
      case 'tarefas-semanais':
        return <OutboundTarefasSection type="weekly" />;
      case 'acompanhamento':
        return <OutboundAcompanhamentoSection />;
      case 'justificativa':
        return <OutboundJustificativaSection role="outbound" />;
      case 'novo-cliente':
        return <OutboundNovoClienteSection />;
      case 'churn':
        return <OutboundChurnSection />;
      default:
        return null;
    }
  };

  return (
    <OutboundManagerProvider targetUserId={user?.id}>
      <MainLayout>
        {/* Notificação de movimentação pendente */}
        <OutboundMovimentacaoNotification />

      <div className="h-full flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">
            Millennials Outbound
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Central de operações do Outbound
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
              {/* Colunas antes do Onboarding */}
              {COLUMNS.map((column) => {
                const Icon = column.icon;
                return (
                  <div
                    key={column.id}
                    className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple"
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

              {/* Onboarding Section - Posição 8 */}
              <div className="flex-shrink-0 flex flex-col">
                <div className={`section-header ${ONBOARDING_SECTION.headerClass} rounded-t-xl`}>
                  <div className="flex items-center gap-3">
                    <Flag size={18} className={ONBOARDING_SECTION.iconColor} />
                    <h2 className="font-semibold">{ONBOARDING_SECTION.title}</h2>
                  </div>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-hidden bg-muted/30 rounded-b-2xl border border-subtle border-t-0 p-4">
                  <OutboundOnboardingSection />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </MainLayout>
    </OutboundManagerProvider>
  );
}
