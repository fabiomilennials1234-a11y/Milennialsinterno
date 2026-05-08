import { useState, useMemo } from 'react';
import { Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTechTasks } from '../../hooks/useTechTasks';
import { useTechProjects } from '../../hooks/useTechProjects';
import { useProfileMap } from '../../hooks/useProfiles';
import type { TechTask } from '../../types';

// ---------------------------------------------------------------------------
// Delay severity
// ---------------------------------------------------------------------------

type Severity = 'critical' | 'warning' | 'ok';

function getSeverity(daysLate: number): Severity {
  if (daysLate >= 5) return 'critical';
  if (daysLate >= 1) return 'warning';
  return 'ok';
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
  critical: { color: 'var(--mtech-danger)', bg: 'rgba(229,72,77,0.12)', label: '5+ dias' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '1-4 dias' },
  ok: { color: 'var(--mtech-success)', bg: 'rgba(48,164,108,0.12)', label: 'No prazo' },
};

// ---------------------------------------------------------------------------
// Select styles (mtech)
// ---------------------------------------------------------------------------

const selectCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] text-xs h-8';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

// ---------------------------------------------------------------------------
// Derived type
// ---------------------------------------------------------------------------

interface DelayedTask {
  id: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string;
  projectId: string | null;
  projectName: string;
  deadline: string;
  daysLate: number;
  severity: Severity;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TechTeamDelaysTable() {
  const { data: tasks = [], isLoading: loadingTasks } = useTechTasks();
  const { data: projects = [], isLoading: loadingProjects } = useTechProjects();
  const profileMap = useProfileMap();

  const [search, setSearch] = useState('');
  const [filterDev, setFilterDev] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');

  // Build project name map
  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  // Get unique devs from tasks
  const uniqueDevs = useMemo(() => {
    const devMap = new Map<string, string>();
    for (const t of tasks as TechTask[]) {
      if (t.assignee_id && !devMap.has(t.assignee_id)) {
        devMap.set(t.assignee_id, profileMap[t.assignee_id] ?? 'Sem nome');
      }
    }
    return Array.from(devMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, profileMap]);

  // Filter & compute delayed tasks
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
        const daysLate = differenceInDays(today, dl);
        return {
          id: t.id,
          title: t.title,
          assigneeId: t.assignee_id,
          assigneeName: t.assignee_id ? (profileMap[t.assignee_id] ?? 'Sem nome') : 'Nao atribuida',
          projectId: t.project_id,
          projectName: t.project_id ? (projectNameMap[t.project_id] ?? 'Projeto') : '—',
          deadline: t.deadline!,
          daysLate,
          severity: getSeverity(daysLate),
        };
      })
      .filter((t) => {
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterDev !== 'all' && t.assigneeId !== filterDev) return false;
        if (filterProject !== 'all' && t.projectId !== filterProject) return false;
        return true;
      })
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [tasks, profileMap, projectNameMap, search, filterDev, filterProject]);

  const isLoading = loadingTasks || loadingProjects;

  // Summary counts
  const criticalCount = delayedTasks.filter((t) => t.severity === 'critical').length;
  const warningCount = delayedTasks.filter((t) => t.severity === 'warning').length;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-[var(--mtech-surface-elev)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--mtech-text-subtle)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefa..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus:outline-none focus:border-[var(--mtech-input-focus)] transition-colors"
          />
        </div>

        {/* Dev filter */}
        <Select value={filterDev} onValueChange={setFilterDev}>
          <SelectTrigger className={`${selectCls} w-[140px]`}>
            <SelectValue placeholder="Dev" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="all">Todos devs</SelectItem>
            {uniqueDevs.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Project filter */}
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className={`${selectCls} w-[140px]`}>
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="all">Todos projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      {delayedTasks.length > 0 && (
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-3.5 w-3.5 text-[var(--mtech-danger)]" />
          <span className="text-[11px] font-medium text-[var(--mtech-danger)]">
            {delayedTasks.length} tarefa{delayedTasks.length !== 1 ? 's' : ''} atrasada{delayedTasks.length !== 1 ? 's' : ''}
          </span>
          {criticalCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--mtech-danger)]/10 text-[var(--mtech-danger)]">
              {criticalCount} critico{criticalCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
              {warningCount} alerta{warningCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      {delayedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <p className="text-xs text-emerald-400 font-medium">Sem atrasos</p>
          <p className="text-[10px] text-[var(--mtech-text-subtle)]">Todas as tarefas em dia.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--mtech-border)] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[var(--mtech-surface-elev)] border-b border-[var(--mtech-border)]">
                <th className="text-left py-2.5 px-3 font-medium text-[var(--mtech-text-muted)] text-[11px]">Tarefa</th>
                <th className="text-left py-2.5 px-3 font-medium text-[var(--mtech-text-muted)] text-[11px]">Responsavel</th>
                <th className="text-left py-2.5 px-3 font-medium text-[var(--mtech-text-muted)] text-[11px]">Projeto</th>
                <th className="text-left py-2.5 px-3 font-medium text-[var(--mtech-text-muted)] text-[11px]">Data prevista</th>
                <th className="text-right py-2.5 px-3 font-medium text-[var(--mtech-text-muted)] text-[11px]">Atraso</th>
              </tr>
            </thead>
            <tbody>
              {delayedTasks.map((task) => {
                const svCfg = SEVERITY_CONFIG[task.severity];
                return (
                  <tr
                    key={task.id}
                    className="border-b border-[var(--mtech-border)]/50 hover:bg-[var(--mtech-surface-elev)]/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-[var(--mtech-text)] max-w-[200px] truncate">
                      {task.title}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--mtech-text-muted)]">
                      {task.assigneeName}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--mtech-text-muted)]">
                      {task.projectName}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--mtech-text-muted)] tabular-nums">
                      {format(new Date(task.deadline), 'dd MMM yyyy', { locale: ptBR })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                        style={{ color: svCfg.color, backgroundColor: svCfg.bg }}
                      >
                        {task.daysLate} dia{task.daysLate !== 1 ? 's' : ''}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-[var(--mtech-text-subtle)]">
        {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
