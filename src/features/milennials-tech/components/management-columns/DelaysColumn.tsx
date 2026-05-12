import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ManagementColumn } from '../ManagementColumn';
import { useTechTasks } from '../../hooks/useTechTasks';
import { useTechProjects } from '../../hooks/useTechProjects';
import { useProfileMap } from '../../hooks/useProfiles';
import type { TechTask } from '../../types';

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------

type Severity = 'critical' | 'warning';

function getSeverity(daysLate: number): Severity {
  return daysLate >= 5 ? 'critical' : 'warning';
}

const SEVERITY_STYLE: Record<Severity, { color: string; bg: string }> = {
  critical: { color: 'var(--mtech-danger)', bg: 'rgba(229,72,77,0.12)' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DelaysColumn() {
  const { data: tasks = [], isLoading: loadingTasks } = useTechTasks();
  const { data: projects = [] } = useTechProjects();
  const profileMap = useProfileMap();

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const delayedTasks = useMemo(() => {
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
        const daysLate = differenceInDays(today, dl);
        return {
          id: t.id,
          title: t.title,
          assigneeName: t.assignee_id
            ? (profileMap[t.assignee_id] ?? 'Sem nome')
            : 'Nao atribuida',
          projectName: t.project_id
            ? (projectNameMap[t.project_id] ?? 'Projeto')
            : null,
          deadline: t.deadline!,
          daysLate,
          severity: getSeverity(daysLate),
        };
      })
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [tasks, profileMap, projectNameMap]);

  const isLoading = loadingTasks;

  return (
    <ManagementColumn
      title="Atrasados"
      icon={AlertTriangle}
      count={delayedTasks.length}
    >
      {isLoading &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-12 rounded-[var(--mtech-radius-md)] bg-[var(--mtech-surface-elev)] animate-pulse"
          />
        ))}

      {!isLoading && delayedTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-1.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <p className="text-[10px] text-emerald-400 font-medium">Sem atrasos</p>
        </div>
      )}

      {!isLoading &&
        delayedTasks.map((task) => {
          const sev = SEVERITY_STYLE[task.severity];
          return (
            <div
              key={task.id}
              className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-2.5 space-y-1"
            >
              <p className="text-[11px] font-medium text-[var(--mtech-text)] truncate leading-tight">
                {task.title}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-[var(--mtech-text-subtle)] truncate">
                  {task.assigneeName}
                </span>
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums flex-shrink-0"
                  style={{ color: sev.color, backgroundColor: sev.bg }}
                >
                  {task.daysLate}d
                </span>
              </div>
              {task.projectName && (
                <p className="text-[9px] text-[var(--mtech-text-subtle)] truncate">
                  {task.projectName}
                </p>
              )}
              <p className="text-[9px] text-[var(--mtech-text-subtle)] tabular-nums">
                {format(new Date(task.deadline), 'dd MMM', { locale: ptBR })}
              </p>
            </div>
          );
        })}
    </ManagementColumn>
  );
}
