import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  UserPlus,
  Clock,
  AlertTriangle,
  Users,
  Wrench,
  Gift,
  Quote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import MeetingOneOnOneSection from '@/components/dash-gestores/MeetingOneOnOneSection';
import SquadDepartmentMetricsSection from '@/components/gestor-projetos/SquadDepartmentMetricsSection';
import SquadNewClientsByDepartmentSection from '@/components/gestor-projetos/SquadNewClientsByDepartmentSection';
import SquadOnboardingSection from '@/components/gestor-projetos/SquadOnboardingSection';
import SquadDelaysByDepartmentSection from '@/components/gestor-projetos/SquadDelaysByDepartmentSection';
import AdsFerramentasSection from '@/components/ads-manager/AdsFerramentasSection';
import AdsBonusSection from '@/components/ads-manager/AdsBonusSection';
import AdsLemasSection from '@/components/ads-manager/AdsLemasSection';

// Colunas do Gestor de Projetos - Focado em Gestão de Squad por Departamento
const COLUMNS = [
  { id: 'metricas', title: 'Métricas por Área', icon: LayoutDashboard, headerClass: 'section-header-blue', iconColor: 'text-white' },
  { id: 'novos-clientes', title: 'Clientes Novos', icon: UserPlus, headerClass: 'section-header-green', iconColor: 'text-white' },
  { id: 'onboarding', title: 'Status Onboarding', icon: Clock, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'atrasados', title: 'Atrasados por Área', icon: AlertTriangle, headerClass: 'section-header-danger', iconColor: 'text-white' },
  { id: 'reuniao-1a1', title: 'Reunião 1 a 1', icon: Users, headerClass: 'section-header-cyan', iconColor: 'text-white' },
  { id: 'ferramentas', title: 'Ferramentas PRO+', icon: Wrench, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'bonus', title: 'Bônus Millennials', icon: Gift, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
  { id: 'lemas', title: 'Lemas', icon: Quote, headerClass: 'section-header-orange', iconColor: 'text-white' },
];

export default function GestorProjetosPage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const allowedRoles = ['gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

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
      case 'metricas':
        return <SquadDepartmentMetricsSection />;
      case 'novos-clientes':
        return <SquadNewClientsByDepartmentSection />;
      case 'onboarding':
        return <SquadOnboardingSection />;
      case 'atrasados':
        return <SquadDelaysByDepartmentSection />;
      case 'reuniao-1a1':
        return <MeetingOneOnOneSection />;
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
            Gestor de Projetos
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Central de gestão do squad e acompanhamento de clientes
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
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
