import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import {
  UserPlus, CheckSquare, ChevronLeft, ChevronRight, Users,
  FileText, AlertCircle, Sparkles, Settings, CheckCircle2, Wrench, GraduationCap,
  LayoutGrid, ListTodo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DepartmentTasksTab from '@/components/department/DepartmentTasksTab';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import DepartmentJustificativaSection from '@/components/department/DepartmentJustificativaSection';
import CrmDelayJustificationsSection from '@/components/gestor-crm/CrmDelayJustificationsSection';
import CrmDailyTasksSection from '@/components/gestor-crm/CrmDailyTasksSection';
import CrmNovoClienteSection from '@/components/gestor-crm/CrmNovoClienteSection';
import CrmBoasVindasSection from '@/components/gestor-crm/CrmBoasVindasSection';
import CrmAcompanhamentoSection from '@/components/gestor-crm/CrmAcompanhamentoSection';
import CrmConfigColumnSection from '@/components/gestor-crm/CrmConfigColumnSection';
import CrmFinalizadosSection from '@/components/gestor-crm/CrmFinalizadosSection';
import CrmDocumentacaoSection from '@/components/gestor-crm/CrmDocumentacaoSection';
import CrmFerramentasProSection from '@/components/gestor-crm/CrmFerramentasProSection';
import { CrmSectionBoundary } from '@/components/gestor-crm/CrmSectionBoundary';
import ManualCondutaBanner from '@/components/shared/ManualCondutaBanner';

// Colunas do kanban do Gestor de CRM — mesma lógica estrutural do Consultor de MKT Place.
// Pegada visual Milennials Tech (escopo `.crm-mtech` em index.css): pretos
// profundos, Geist, headers uppercase tracking-widest, cards radius-md.
// `semantic`: cor = informação. Só Justificativa (danger) e CRMs Finalizados
// (success) são ESTADOS → ícone ganha acento. As demais são FASES de fluxo;
// cor ali seria decoração (rainbow Trello). Hierarquia fica na tipografia.
type ColumnSemantic = 'neutral' | 'danger' | 'success';
const COLUMNS: { id: string; title: string; icon: typeof FileText; semantic: ColumnSemantic }[] = [
  { id: 'documentacao', title: 'Documentação do dia', icon: FileText, semantic: 'neutral' },
  { id: 'tarefas-diarias', title: 'Tarefas Diárias', icon: CheckSquare, semantic: 'neutral' },
  { id: 'novos-clientes', title: 'Novos clientes', icon: UserPlus, semantic: 'neutral' },
  { id: 'boas-vindas', title: 'Boas-vindas — Novos clientes', icon: Sparkles, semantic: 'neutral' },
  { id: 'acompanhamento', title: 'Acompanhamento diário', icon: Users, semantic: 'neutral' },
  { id: 'config-v8', title: 'Configuração V8', icon: Wrench, semantic: 'neutral' },
  { id: 'config-automation', title: 'Configuração Automation', icon: Settings, semantic: 'neutral' },
  { id: 'config-copilot', title: 'Configuração Copilot', icon: Settings, semantic: 'neutral' },
  { id: 'justificativa', title: 'Justificativa', icon: AlertCircle, semantic: 'danger' },
  { id: 'finalizados', title: 'CRMs Finalizados', icon: CheckCircle2, semantic: 'success' },
  { id: 'ferramentas-pro', title: 'Ferramentas PRO+', icon: GraduationCap, semantic: 'neutral' },
];

export default function GestorCRMPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeView, setActiveView] = useState<'kanban' | 'tarefas'>('kanban');

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

  const renderColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'documentacao':
        return <CrmSectionBoundary name="Documentação"><CrmDocumentacaoSection /></CrmSectionBoundary>;
      case 'tarefas-diarias':
        return <CrmSectionBoundary name="Tarefas Diárias"><CrmDailyTasksSection /></CrmSectionBoundary>;
      case 'novos-clientes':
        return <CrmSectionBoundary name="Novos clientes"><CrmNovoClienteSection /></CrmSectionBoundary>;
      case 'boas-vindas':
        return <CrmSectionBoundary name="Boas-vindas"><CrmBoasVindasSection /></CrmSectionBoundary>;
      case 'acompanhamento':
        return <CrmSectionBoundary name="Acompanhamento"><CrmAcompanhamentoSection /></CrmSectionBoundary>;
      case 'config-v8':
        return <CrmSectionBoundary name="Config V8"><CrmConfigColumnSection produto="v8" /></CrmSectionBoundary>;
      case 'config-automation':
        return <CrmSectionBoundary name="Config Automation"><CrmConfigColumnSection produto="automation" /></CrmSectionBoundary>;
      case 'config-copilot':
        return <CrmSectionBoundary name="Config Copilot"><CrmConfigColumnSection produto="copilot" /></CrmSectionBoundary>;
      case 'justificativa':
        return (
          <div className="space-y-4">
            <CrmDelayJustificationsSection />
            <DepartmentJustificativaSection department="gestor_crm" />
          </div>
        );
      case 'finalizados':
        return <CrmSectionBoundary name="CRMs Finalizados"><CrmFinalizadosSection /></CrmSectionBoundary>;
      case 'ferramentas-pro':
        return <CrmSectionBoundary name="Ferramentas PRO+"><CrmFerramentasProSection /></CrmSectionBoundary>;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="crm-mtech flex flex-col" style={{ background: 'var(--mtech-bg)' }}>
        <div
          className="px-8 py-6 shrink-0 sticky top-0 z-20"
          style={{ background: 'var(--mtech-bg)', borderBottom: '1px solid var(--mtech-border)' }}
        >
          <h1 className="text-display" style={{ color: 'var(--mtech-text)' }}>Gestor de CRM</h1>
          <p className="text-caption mt-1" style={{ color: 'var(--mtech-text-muted)' }}>
            Kanban do Torque CRM — V8, Automation e Copilot
          </p>
          <ManualCondutaBanner />

          {/* View toggle — segmented control mtech. Ativo: accent ouro contido. */}
          <div
            className="flex gap-1 rounded-lg p-1 mt-4 w-fit"
            style={{ background: 'var(--mtech-surface)', border: '1px solid var(--mtech-border)' }}
          >
            <button
              onClick={() => setActiveView('kanban')}
              aria-pressed={activeView === 'kanban'}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mtech-accent)]/50',
                activeView === 'kanban'
                  ? 'bg-[var(--mtech-accent)] text-[var(--mtech-bg)]'
                  : 'text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)]'
              )}
            >
              <LayoutGrid size={16} />
              Kanban
            </button>
            <button
              onClick={() => setActiveView('tarefas')}
              aria-pressed={activeView === 'tarefas'}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mtech-accent)]/50',
                activeView === 'tarefas'
                  ? 'bg-[var(--mtech-accent)] text-[var(--mtech-bg)]'
                  : 'text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)]'
              )}
            >
              <ListTodo size={16} />
              Tarefas
            </button>
          </div>
        </div>

        {/* Board Container or Tasks Tab */}
        {activeView === 'tarefas' ? (
          <DepartmentTasksTab department="gestor_crm" />
        ) : (
        <div className="flex-1 relative">
          {canScrollLeft && (
            <button
              aria-label="Rolar para a esquerda"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mtech-accent)]/50"
              style={{ background: 'var(--mtech-surface-elev)', border: '1px solid var(--mtech-border)', boxShadow: 'var(--mtech-shadow-card)' }}
              onClick={() => scrollContainerRef.current?.scrollBy({ left: -380, behavior: 'smooth' })}
            >
              <ChevronLeft size={18} style={{ color: 'var(--mtech-text-muted)' }} />
            </button>
          )}
          {canScrollRight && (
            <button
              aria-label="Rolar para a direita"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mtech-accent)]/50"
              style={{ background: 'var(--mtech-surface-elev)', border: '1px solid var(--mtech-border)', boxShadow: 'var(--mtech-shadow-card)' }}
              onClick={() => scrollContainerRef.current?.scrollBy({ left: 380, behavior: 'smooth' })}
            >
              <ChevronRight size={18} style={{ color: 'var(--mtech-text-muted)' }} />
            </button>
          )}

          <div ref={scrollContainerRef} className="overflow-x-auto px-8 py-6 scrollbar-apple">
            <div className="flex gap-5 pb-4" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map(column => {
                const Icon = column.icon;
                return (
                  <div
                    key={column.id}
                    className={cn(
                      'crm-column w-[320px] flex-shrink-0 flex flex-col overflow-hidden',
                      column.semantic === 'danger' && 'crm-column--danger',
                      column.semantic === 'success' && 'crm-column--success'
                    )}
                  >
                    <div className="crm-column-header">
                      <Icon />
                      <h2 className="crm-column-title truncate">{column.title}</h2>
                    </div>
                    <div className="crm-column-body flex-1 overflow-y-auto p-3 scrollbar-apple">
                      {renderColumnContent(column.id)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}
      </div>
    </MainLayout>
  );
}
