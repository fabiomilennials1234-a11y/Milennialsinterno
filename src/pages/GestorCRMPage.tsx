import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { LayoutGrid, ListTodo, HeartHandshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import DepartmentTasksTab from '@/components/department/DepartmentTasksTab';
import CrmBoardKanban from '@/components/gestor-crm/CrmBoardKanban';
import CrmAcompanhamentosBoard from '@/components/gestor-crm/CrmAcompanhamentosBoard';
import ManualCondutaBanner from '@/components/shared/ManualCondutaBanner';

// Gestor de CRM — Board Torque CRM (ADR 0006). Pegada visual Milennials Tech
// (escopo `.crm-mtech` em index.css): pretos profundos, Geist, headers uppercase
// tracking-widest, cards radius-md.
//
// Slice 1 (#91): a aba KANBAN renderiza o board NOVO de 6 colunas em modo
// LEITURA (CrmBoardKanban). O board antigo de 11 colunas-seção foi aposentado
// pelo ADR 0006 — os componentes de seção continuam no repo (dormentes), mas
// saíram desta página. As interações do board novo chegam nas slices #92–97.
export default function GestorCRMPage() {
  const [activeView, setActiveView] = useState<'kanban' | 'tarefas' | 'acompanhamentos'>('kanban');

  return (
    <MainLayout>
      <div className="crm-mtech flex flex-col min-h-full" style={{ background: 'var(--mtech-bg)' }}>
        <div
          className="px-8 py-6 shrink-0 sticky top-0 z-20"
          style={{ background: 'var(--mtech-bg)', borderBottom: '1px solid var(--mtech-border)' }}
        >
          <h1 className="text-display" style={{ color: 'var(--mtech-text)' }}>Gestor de CRM</h1>
          <p className="text-caption mt-1" style={{ color: 'var(--mtech-text-muted)' }}>
            Board do Torque CRM — Torque, Automation e Copilot
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
            <button
              onClick={() => setActiveView('acompanhamentos')}
              aria-pressed={activeView === 'acompanhamentos'}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mtech-accent)]/50',
                activeView === 'acompanhamentos'
                  ? 'bg-[var(--mtech-accent)] text-[var(--mtech-bg)]'
                  : 'text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)]'
              )}
            >
              <HeartHandshake size={16} />
              Acompanhamentos
            </button>
          </div>
        </div>

        {/* Board Torque CRM (read-only) | Tarefas | Acompanhamentos (pós-implantação) */}
        {activeView === 'tarefas' ? (
          <DepartmentTasksTab department="gestor_crm" />
        ) : activeView === 'acompanhamentos' ? (
          <CrmAcompanhamentosBoard />
        ) : (
          <CrmBoardKanban />
        )}
      </div>
    </MainLayout>
  );
}
