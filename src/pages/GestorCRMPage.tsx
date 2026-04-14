import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  UserPlus, CheckSquare, ChevronLeft, ChevronRight, Users,
  FileText, AlertCircle, Sparkles, Settings, CheckCircle2, Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';
import DepartmentJustificativaSection from '@/components/department/DepartmentJustificativaSection';
import CrmNovoClienteSection from '@/components/gestor-crm/CrmNovoClienteSection';
import CrmBoasVindasSection from '@/components/gestor-crm/CrmBoasVindasSection';
import CrmAcompanhamentoSection from '@/components/gestor-crm/CrmAcompanhamentoSection';
import { CrmSectionBoundary } from '@/components/gestor-crm/CrmSectionBoundary';

// Colunas do kanban do Gestor de CRM — mesma lógica estrutural do Consultor de MKT Place.
// As três colunas de "Configuração" (V8/Automation/Copilot) e "CRMs Finalizados" entram
// com placeholders em Commit 2 e serão povoadas em Commit 3 e Commit 4.
const COLUMNS = [
  { id: 'documentacao', title: 'Documentação do dia', icon: FileText, headerClass: 'section-header-orange', iconColor: 'text-white' },
  { id: 'tarefas-diarias', title: 'Tarefas Diárias', icon: CheckSquare, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
  { id: 'novos-clientes', title: 'Novos clientes', icon: UserPlus, headerClass: 'section-header-green', iconColor: 'text-white' },
  { id: 'boas-vindas', title: 'Boas-vindas — Novos clientes', icon: Sparkles, headerClass: 'section-header-emerald', iconColor: 'text-white' },
  { id: 'acompanhamento', title: 'Acompanhamento diário', icon: Users, headerClass: 'section-header-blue', iconColor: 'text-white' },
  { id: 'config-v8', title: 'Configuração V8', icon: Wrench, headerClass: 'section-header-sky', iconColor: 'text-white' },
  { id: 'config-automation', title: 'Configuração Automation', icon: Settings, headerClass: 'section-header-violet', iconColor: 'text-white' },
  { id: 'config-copilot', title: 'Configuração Copilot', icon: Settings, headerClass: 'section-header-amber', iconColor: 'text-foreground' },
  { id: 'justificativa', title: 'Justificativa', icon: AlertCircle, headerClass: 'section-header-danger', iconColor: 'text-white' },
  { id: 'finalizados', title: 'CRMs Finalizados', icon: CheckCircle2, headerClass: 'section-header-purple', iconColor: 'text-white' },
];

function ComingSoonPlaceholder({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p className="text-sm font-medium">Disponível em breve</p>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  );
}

export default function GestorCRMPage() {
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

  const allowedRoles = ['gestor_crm', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);
  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  const renderColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'documentacao':
        return <ComingSoonPlaceholder label="Documentação diária — Commit 5" />;
      case 'tarefas-diarias':
        return <DepartmentTarefasSection department="gestor_crm" type="daily" />;
      case 'novos-clientes':
        return <CrmSectionBoundary name="Novos clientes"><CrmNovoClienteSection /></CrmSectionBoundary>;
      case 'boas-vindas':
        return <CrmSectionBoundary name="Boas-vindas"><CrmBoasVindasSection /></CrmSectionBoundary>;
      case 'acompanhamento':
        return <CrmSectionBoundary name="Acompanhamento"><CrmAcompanhamentoSection /></CrmSectionBoundary>;
      case 'config-v8':
        return <ComingSoonPlaceholder label="Cards V8 — Commit 3" />;
      case 'config-automation':
        return <ComingSoonPlaceholder label="Cards Automation — Commit 3" />;
      case 'config-copilot':
        return <ComingSoonPlaceholder label="Cards Copilot — Commit 3" />;
      case 'justificativa':
        return <DepartmentJustificativaSection department="gestor_crm" />;
      case 'finalizados':
        return <ComingSoonPlaceholder label="CRMs Finalizados — Commit 4" />;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">Gestor de CRM</h1>
          <p className="text-caption text-muted-foreground mt-1">Kanban do Torque CRM — V8, Automation e Copilot</p>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {canScrollLeft && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted"
              onClick={() => scrollContainerRef.current?.scrollBy({ left: -380, behavior: 'smooth' })}
            >
              <ChevronLeft size={18} className="text-muted-foreground" />
            </Button>
          )}
          {canScrollRight && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted"
              onClick={() => scrollContainerRef.current?.scrollBy({ left: 380, behavior: 'smooth' })}
            >
              <ChevronRight size={18} className="text-muted-foreground" />
            </Button>
          )}

          <div ref={scrollContainerRef} className="h-full overflow-x-auto overflow-y-hidden px-8 py-6 scrollbar-apple">
            <div className="flex gap-6 h-full pb-4" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map(column => {
                const Icon = column.icon;
                return (
                  <div
                    key={column.id}
                    className="w-[340px] h-full flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple"
                  >
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
