import { useRef, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  LayoutDashboard,
  AlertTriangle,
  ClipboardList,
  CheckSquare,
  Wrench,
  Gift,
  Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import MeetingOneOnOneSection from '@/components/dash-gestores/MeetingOneOnOneSection';
import AdsFerramentasSection from '@/components/ads-manager/AdsFerramentasSection';
import AdsBonusSection from '@/components/ads-manager/AdsBonusSection';
import AdsLemasSection from '@/components/ads-manager/AdsLemasSection';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';

import TechTeamDevCards from './team/TechTeamDevCards';
import TechTeamProjectStatus from './team/TechTeamProjectStatus';
import TechTeamDelays from './team/TechTeamDelays';
import TechTeamJustifications from './team/TechTeamJustifications';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS = [
  { id: 'devs', title: 'Devs do Time', icon: Users, headerClass: 'section-header-blue', iconColor: 'text-white' },
  { id: 'status-projetos', title: 'Status Projetos por Dev', icon: LayoutDashboard, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'atrasados', title: 'Atrasados', icon: AlertTriangle, headerClass: 'section-header-danger', iconColor: 'text-white' },
  { id: 'atrasos-justificativas', title: 'Atrasos + Justificativas', icon: ClipboardList, headerClass: 'section-header-orange', iconColor: 'text-white' },
  { id: 'tarefas-recorrentes', title: 'Tarefas Recorrentes', icon: CheckSquare, headerClass: 'section-header-sky', iconColor: 'text-white' },
  { id: 'reuniao-1a1', title: 'Reuniao 1 a 1', icon: Users, headerClass: 'section-header-cyan', iconColor: 'text-white' },
  { id: 'ferramentas', title: 'Ferramentas PRO+', icon: Wrench, headerClass: 'section-header-purple', iconColor: 'text-white' },
  { id: 'bonus', title: 'Bonus Millennials', icon: Gift, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
  { id: 'lemas', title: 'Lemas', icon: Quote, headerClass: 'section-header-orange', iconColor: 'text-white' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TechTeamView() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10,
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
      case 'devs':
        return <TechTeamDevCards />;
      case 'status-projetos':
        return <TechTeamProjectStatus />;
      case 'atrasados':
        return <TechTeamDelays />;
      case 'atrasos-justificativas':
        return <TechTeamJustifications />;
      case 'tarefas-recorrentes':
        return <DepartmentTarefasSection department="devs" type="daily" />;
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
    <div className="relative overflow-hidden -mx-8 h-[calc(100vh-16rem)]">
      {/* Scroll buttons */}
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

      {/* Scrollable container */}
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
  );
}
