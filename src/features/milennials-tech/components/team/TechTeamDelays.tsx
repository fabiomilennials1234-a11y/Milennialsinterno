import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTechTasks } from '../../hooks/useTechTasks';
import { useTechProjects } from '../../hooks/useTechProjects';
import { useProfileMap } from '../../hooks/useProfiles';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { TechTask } from '../../types';

// ---------------------------------------------------------------------------
// Derived type
// ---------------------------------------------------------------------------

interface DelayedTask {
  id: string;
  title: string;
  assigneeName: string;
  projectName: string;
  deadline: string;
  daysLate: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TechTeamDelays() {
  const { data: tasks = [], isLoading: loadingTasks } = useTechTasks();
  const { data: projects = [], isLoading: loadingProjects } = useTechProjects();
  const profileMap = useProfileMap();

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const delayedTasks: DelayedTask[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (tasks as TechTask[])
      .filter((t) => {
        if (t.status === 'DONE') return false;
        if (!t.deadline) return false;
        const dl = new Date(t.deadline);
        dl.setHours(0, 0, 0, 0);
        return dl < today;
      })
      .map((t) => {
        const dl = new Date(t.deadline!);
        dl.setHours(0, 0, 0, 0);
        return {
          id: t.id,
          title: t.title,
          assigneeName: t.assignee_id ? (profileMap[t.assignee_id] ?? 'Sem nome') : 'Nao atribuida',
          projectName: t.project_id ? (projectNameMap[t.project_id] ?? 'Projeto') : '—',
          deadline: t.deadline!,
          daysLate: differenceInDays(today, dl),
        };
      })
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [tasks, profileMap, projectNameMap]);

  if (loadingTasks || loadingProjects) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--mtech-surface-elev)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (delayedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        <p className="text-xs text-emerald-400 font-medium">Sem atrasos</p>
        <p className="text-[10px] text-[var(--mtech-text-subtle)]">Todas as tarefas em dia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-3.5 w-3.5 text-[var(--mtech-danger)]" />
        <span className="text-[11px] font-medium text-[var(--mtech-danger)]">
          {delayedTasks.length} tarefa{delayedTasks.length !== 1 ? 's' : ''} atrasada{delayedTasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {delayedTasks.map((task) => (
        <div
          key={task.id}
          className="rounded-lg border border-[var(--mtech-danger)]/20 bg-[var(--mtech-danger)]/5 p-2.5"
        >
          <p className="text-[12px] font-medium text-[var(--mtech-text)] truncate mb-1">
            {task.title}
          </p>

          <div className="flex items-center gap-2 text-[10px] text-[var(--mtech-text-subtle)]">
            <span className="truncate max-w-[90px]">{task.assigneeName}</span>
            <span className="opacity-40">|</span>
            <span className="truncate max-w-[80px]">{task.projectName}</span>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-[var(--mtech-text-subtle)]">
              Prazo: {format(new Date(task.deadline), "dd MMM", { locale: ptBR })}
            </span>
            <span className="text-[10px] font-semibold text-[var(--mtech-danger)]">
              {task.daysLate} dia{task.daysLate !== 1 ? 's' : ''} atrasado
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
