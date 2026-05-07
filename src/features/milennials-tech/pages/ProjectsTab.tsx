import { useState, useMemo } from 'react';
import { Plus, Kanban, Users, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTechProjects, type TechProjectFilters } from '../hooks/useTechProjects';
import { useTechProfiles } from '../hooks/useProfiles';
import { ProjectsKanbanView } from '../components/ProjectsKanbanView';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { TeamMatrixView } from '../components/TeamMatrixView';
import type { ProjectType, ProjectPriority } from '../lib/projectSteps';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const selectCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] text-xs h-8';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectsTab() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'equipe'>('kanban');
  const [hideCompleted, setHideCompleted] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<ProjectType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<ProjectPriority | 'all'>('all');
  const [filterLead, setFilterLead] = useState<string | 'all'>('all');

  // Build query filters — never filter by status server-side; we do it client-side
  const queryFilters = useMemo<TechProjectFilters>(() => {
    const f: TechProjectFilters = {};
    if (filterType !== 'all') f.type = filterType;
    if (filterPriority !== 'all') f.priority = filterPriority;
    if (filterLead !== 'all') f.leadId = filterLead;
    return f;
  }, [filterType, filterPriority, filterLead]);

  const { data: projects = [], isLoading } = useTechProjects(queryFilters);
  const { data: profiles = [] } = useTechProfiles();

  // Client-side: hide completed when toggle is on
  const filteredProjects = useMemo(() => {
    if (!hideCompleted) return projects;
    return projects.filter((p) => p.status !== 'completed');
  }, [projects, hideCompleted]);

  const hasActiveFilters = filterType !== 'all' || filterPriority !== 'all' || filterLead !== 'all';

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-[var(--mtech-text)]">Projetos</h2>

          {/* View toggle */}
          <div className="flex items-center rounded-md border border-[var(--mtech-border)] overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)]'
                  : 'text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-text-muted)]'
              }`}
            >
              <Kanban className="h-3 w-3" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('equipe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                viewMode === 'equipe'
                  ? 'bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)]'
                  : 'text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-text-muted)]'
              }`}
            >
              <Users className="h-3 w-3" />
              Equipe
            </button>
          </div>

          {/* Hide completed toggle */}
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`px-3 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${
              hideCompleted
                ? 'border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)]'
                : 'border-[var(--mtech-border)] text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-text-muted)]'
            }`}
          >
            {hideCompleted ? 'Esconder concluidos' : 'Todos'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilterType('all');
                  setFilterPriority('all');
                  setFilterLead('all');
                }}
                className="text-[10px] text-[var(--mtech-accent)] hover:underline"
              >
                Limpar filtros
              </button>
            )}

            <Select value={filterType} onValueChange={(v) => setFilterType(v as ProjectType | 'all')}>
              <SelectTrigger className={`${selectCls} w-[110px]`}>
                <Filter className="h-3 w-3 mr-1 flex-shrink-0 text-[var(--mtech-text-subtle)]" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="internal">Interno</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as ProjectPriority | 'all')}>
              <SelectTrigger className={`${selectCls} w-[120px]`}>
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all">Prioridades</SelectItem>
                <SelectItem value="critical">Critica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterLead} onValueChange={setFilterLead}>
              <SelectTrigger className={`${selectCls} w-[130px]`}>
                <SelectValue placeholder="Lead" />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all">Todos leads</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New project button */}
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </div>
      </div>

      {/* Kanban view */}
      {viewMode === 'kanban' && (
        <ProjectsKanbanView projects={filteredProjects} isLoading={isLoading} />
      )}

      {viewMode === 'equipe' && <TeamMatrixView />}

      {/* Create modal */}
      <ProjectFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </>
  );
}
