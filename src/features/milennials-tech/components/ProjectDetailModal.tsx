import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Pencil,
  X,
  FolderKanban,
} from 'lucide-react';
import type { TechProjectRow } from '../hooks/useTechProjects';
import { useUpdateTechProject, techProjectKeys } from '../hooks/useTechProjects';
import { TaskFormModal } from './TaskFormModal';
import {
  useTechProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMemberHours,
} from '../hooks/useTechProjectMembers';
import { useTechTasks } from '../hooks/useTechTasks';
import { useTechProfiles, getInitials } from '../hooks/useProfiles';
import {
  PROJECT_STEP_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_PRIORITY_LABEL,
  PROJECT_MEMBER_ROLE_LABEL,
  type ProjectStep,
  type ProjectStatus,
  type ProjectPriority,
  type ProjectMemberRole,
} from '../lib/projectSteps';
import { STATUS_LABEL_PT, TYPE_LABEL_FRIENDLY } from '../lib/statusLabels';
import type { TechTask, TechTaskType, TechTaskPriority } from '../types';
import ProjectTarefasSection from '@/components/project/ProjectTarefasSection';

// ---------------------------------------------------------------------------
// Styles (reuse mtech patterns)
// ---------------------------------------------------------------------------

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const labelCls = 'text-[10px] font-semibold text-[var(--mtech-text-subtle)] uppercase tracking-widest';
const sectionTitleCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';

// ---------------------------------------------------------------------------
// Priority config for task mini-rows
// ---------------------------------------------------------------------------

const PRIORITY_DOT_COLOR: Record<TechTaskPriority, string> = {
  CRITICAL: 'var(--mtech-accent)',
  HIGH: '#E5484D',
  MEDIUM: '#EAB308',
  LOW: '#5A5A66',
};

const TYPE_COLOR: Record<TechTaskType, string> = {
  BUG: '#E5484D',
  FEATURE: '#3B82F6',
  HOTFIX: '#F97316',
  CHORE: '#8A8A95',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectDetailModalProps {
  project: TechProjectRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectDetailModal({ project, open, onOpenChange }: ProjectDetailModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateProject = useUpdateTechProject();
  const { data: members = [], isLoading: membersLoading } = useTechProjectMembers(project.id);
  const { data: projectTasks = [], isLoading: tasksLoading } = useTechTasks({ projectId: project.id });
  const { data: profiles = [] } = useTechProfiles();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const updateMemberHours = useUpdateProjectMemberHours();

  // Task form modal
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Inline editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ProjectMemberRole>('dev');

  // Members already in project (for excluding from add dropdown)
  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const availableProfiles = useMemo(
    () => profiles.filter((p) => !memberUserIds.has(p.user_id)),
    [profiles, memberUserIds],
  );

  // Task stats
  const tasksDone = projectTasks.filter((t) => t.status === 'DONE').length;
  const tasksTotal = projectTasks.length;

  // Group tasks by status for mini-list
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, TechTask[]> = {};
    for (const t of projectTasks) {
      if (!groups[t.status]) groups[t.status] = [];
      groups[t.status].push(t);
    }
    return groups;
  }, [projectTasks]);

  // Inline edit handlers
  const startEdit = useCallback((field: string, currentValue: string) => {
    setEditingField(field);
    setEditDraft(currentValue);
  }, []);

  const saveEdit = useCallback(
    (field: string) => {
      if (!editDraft.trim() && field === 'name') return;
      updateProject.mutate({
        id: project.id,
        patch: { [field]: editDraft.trim() || null },
      });
      setEditingField(null);
    },
    [editDraft, project.id, updateProject],
  );

  const handleAddMember = useCallback(() => {
    if (!newMemberUserId) return;
    addMember.mutate(
      {
        project_id: project.id,
        user_id: newMemberUserId,
        role: newMemberRole,
      },
      {
        onSuccess: () => {
          setNewMemberUserId('');
          setAddingMember(false);
        },
      },
    );
  }, [newMemberUserId, newMemberRole, project.id, addMember]);

  const handleRemoveMember = useCallback(
    (userId: string) => {
      removeMember.mutate({ projectId: project.id, userId });
    },
    [project.id, removeMember],
  );

  const handleHoursChange = useCallback(
    (userId: string, hours: number) => {
      updateMemberHours.mutate({
        projectId: project.id,
        userId,
        allocatedHoursWeek: hours,
      });
    },
    [project.id, updateMemberHours],
  );

  const handleTaskFormClose = useCallback((open: boolean) => {
    setShowTaskForm(open);
    if (!open) {
      queryClient.invalidateQueries({ queryKey: techProjectKeys.all });
    }
  }, [queryClient]);

  const handleViewInKanban = useCallback(() => {
    onOpenChange(false);
    navigate(`/milennials-tech/kanban?project=${project.id}`);
  }, [navigate, onOpenChange, project.id]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderEditableField = (
    field: string,
    label: string,
    value: string | null,
    placeholder: string,
  ) => {
    const isEditing = editingField === field;
    return (
      <div className="space-y-1">
        <span className={labelCls}>{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(field);
                if (e.key === 'Escape') setEditingField(null);
              }}
              className={`${inputCls} h-7 text-sm`}
            />
            <Button
              size="sm"
              onClick={() => saveEdit(field)}
              className="bg-[var(--mtech-accent)] text-black h-7 px-2 text-xs"
            >
              OK
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingField(null)}
              className="h-7 px-1.5 text-[var(--mtech-text-subtle)]"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <p
            onClick={() => startEdit(field, value ?? '')}
            className="group/field flex items-center gap-1.5 text-sm text-[var(--mtech-text)] cursor-pointer hover:text-[var(--mtech-accent)] transition-colors min-h-[28px]"
          >
            <span className={value ? '' : 'text-[var(--mtech-text-subtle)] italic'}>
              {value || placeholder}
            </span>
            <Pencil className="h-3 w-3 text-[var(--mtech-text-subtle)] opacity-0 group-hover/field:opacity-100 transition-opacity" />
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope max-w-3xl max-h-[90vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogDescription className="sr-only">
            Detalhes do projeto {project.name}
          </DialogDescription>

          {/* Project name -- editable */}
          {editingField === 'name' ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit('name');
                  if (e.key === 'Escape') setEditingField(null);
                }}
                className={`${inputCls} text-lg font-semibold`}
              />
              <Button
                size="sm"
                onClick={() => saveEdit('name')}
                className="bg-[var(--mtech-accent)] text-black h-8"
              >
                Salvar
              </Button>
            </div>
          ) : (
            <DialogTitle
              className="group/title flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--mtech-text)] cursor-pointer hover:text-[var(--mtech-accent)] transition-colors"
              onClick={() => startEdit('name', project.name)}
            >
              {project.name}
              <Pencil className="h-3.5 w-3.5 text-[var(--mtech-text-subtle)] opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </DialogTitle>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-4">
          {/* -------- LEFT: Info + Tasks -------- */}
          <div className="space-y-6 min-w-0">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none border border-[var(--mtech-border)] text-[var(--mtech-text-muted)]">
                {PROJECT_STATUS_LABEL[project.status as ProjectStatus] ?? project.status}
              </span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
                style={{
                  color: project.type === 'client' ? '#3B82F6' : '#8A8A95',
                  backgroundColor: project.type === 'client' ? 'rgba(59,130,246,0.14)' : 'rgba(138,138,149,0.14)',
                }}
              >
                {project.type === 'client' ? 'Cliente' : 'Interno'}
              </span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
                style={{
                  color: project.priority === 'critical' ? '#E5484D' : project.priority === 'high' ? '#F97316' : '#8A8A95',
                  backgroundColor: project.priority === 'critical' ? 'rgba(229,72,77,0.14)' : project.priority === 'high' ? 'rgba(249,115,22,0.14)' : 'rgba(138,138,149,0.1)',
                }}
              >
                {PROJECT_PRIORITY_LABEL[project.priority as ProjectPriority] ?? project.priority}
              </span>
              <span className="text-[10px] text-[var(--mtech-text-subtle)] uppercase tracking-wider font-medium">
                {PROJECT_STEP_LABEL[project.current_step as ProjectStep] ?? project.current_step}
              </span>
            </div>

            {/* Editable fields */}
            {renderEditableField('description', 'Descricao', project.description, 'Adicionar descricao...')}

            {/* Dates row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className={labelCls}>Inicio</span>
                <p className="text-sm text-[var(--mtech-text)]" data-mono>
                  {project.start_date
                    ? new Date(project.start_date + 'T00:00:00').toLocaleDateString('pt-BR')
                    : '--'}
                </p>
              </div>
              <div className="space-y-1">
                <span className={labelCls}>Prazo</span>
                <p className="text-sm text-[var(--mtech-text)]" data-mono>
                  {project.deadline
                    ? new Date(project.deadline + 'T00:00:00').toLocaleDateString('pt-BR')
                    : '--'}
                </p>
              </div>
              <div className="space-y-1">
                <span className={labelCls}>Horas est.</span>
                <p className="text-sm text-[var(--mtech-text)]" data-mono>
                  {project.estimated_hours ?? '--'}h
                </p>
              </div>
            </div>

            {/* Client */}
            {project.client_name && project.type === 'client' && (
              <div className="space-y-1">
                <span className={labelCls}>Cliente</span>
                <p className="text-sm text-[var(--mtech-text)]">{project.client_name}</p>
              </div>
            )}

            {/* Tasks section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className={sectionTitleCls}>
                  Tasks ({tasksDone}/{tasksTotal})
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTaskForm(true)}
                    className="h-7 text-[11px] text-[var(--mtech-accent)] hover:text-[var(--mtech-accent)] gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Nova Task
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleViewInKanban}
                    className="h-7 text-[11px] text-[var(--mtech-accent)] hover:text-[var(--mtech-accent)] gap-1"
                  >
                    <FolderKanban className="h-3 w-3" />
                    Ver no Kanban
                  </Button>
                </div>
              </div>

              {tasksLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-8 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
                  ))}
                </div>
              ) : tasksTotal === 0 ? (
                <p className="text-xs text-[var(--mtech-text-subtle)] py-4 text-center">
                  Nenhuma task vinculada a este projeto.
                </p>
              ) : (
                <div className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-bg)] overflow-hidden max-h-[280px] overflow-y-auto">
                  {Object.entries(tasksByStatus).map(([status, tasks]) => (
                    <div key={status}>
                      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[var(--mtech-surface-elev)] border-b border-[var(--mtech-border)]">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)]">
                          {STATUS_LABEL_PT[status as keyof typeof STATUS_LABEL_PT] ?? status}
                        </span>
                        <span className="text-[10px] text-[var(--mtech-text-subtle)]" data-mono>
                          {tasks.length}
                        </span>
                      </div>
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 px-3 py-2 border-b border-[var(--mtech-border)] last:border-b-0 hover:bg-[var(--mtech-surface)] transition-colors"
                        >
                          <span
                            className="flex-shrink-0 rounded-full"
                            style={{
                              width: 6,
                              height: 6,
                              backgroundColor: PRIORITY_DOT_COLOR[task.priority],
                            }}
                          />
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
                            style={{ color: TYPE_COLOR[task.type] }}
                          >
                            {TYPE_LABEL_FRIENDLY[task.type].label}
                          </span>
                          <span className="flex-1 truncate text-xs text-[var(--mtech-text)]">
                            {task.title}
                          </span>
                          {task.status === 'DONE' && (
                            <CheckCircle2 className="h-3 w-3 text-[var(--mtech-success)] flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Department tasks: Daily */}
            <div>
              <h3 className={sectionTitleCls + ' mb-3'}>Tarefas Diarias</h3>
              <ProjectTarefasSection projectId={project.id} type="daily" />
            </div>

            {/* Department tasks: Weekly */}
            <div>
              <h3 className={sectionTitleCls + ' mb-3'}>Tarefas Semanais</h3>
              <ProjectTarefasSection projectId={project.id} type="weekly" />
            </div>
          </div>

          {/* -------- RIGHT: Members -------- */}
          <div className="border-l border-[var(--mtech-border)] pl-5 space-y-4">
            {/* Lead */}
            <div className="space-y-1">
              <span className={labelCls}>Lead</span>
              <div className="flex items-center gap-2">
                {project.lead_name ? (
                  <>
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/30 text-[10px] font-bold text-[var(--mtech-accent)] select-none">
                      {getInitials(project.lead_name)}
                    </span>
                    <span className="text-sm text-[var(--mtech-text)]">{project.lead_name}</span>
                  </>
                ) : (
                  <span className="text-sm text-[var(--mtech-text-subtle)] italic">Sem lead</span>
                )}
              </div>
            </div>

            {/* Members list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={sectionTitleCls}>
                  <Users className="inline h-3 w-3 mr-1" />
                  Membros ({members.length})
                </h3>
                <button
                  onClick={() => setAddingMember(!addingMember)}
                  className="text-[var(--mtech-accent)] hover:text-[var(--mtech-accent)]/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Add member form */}
              {addingMember && (
                <div className="space-y-2 mb-3 p-2 rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
                  <Select value={newMemberUserId || '__none__'} onValueChange={(v) => setNewMemberUserId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className={`${inputCls} h-7 text-xs`}>
                      <SelectValue placeholder="Selecionar pessoa" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50 max-h-48">
                      <SelectItem value="__none__">Selecionar...</SelectItem>
                      {availableProfiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as ProjectMemberRole)}>
                    <SelectTrigger className={`${inputCls} h-7 text-xs`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50">
                      {(Object.entries(PROJECT_MEMBER_ROLE_LABEL) as [ProjectMemberRole, string][]).map(
                        ([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={handleAddMember}
                      disabled={!newMemberUserId || addMember.isPending}
                      className="bg-[var(--mtech-accent)] text-black h-6 px-2 text-[10px] font-semibold flex-1"
                    >
                      {addMember.isPending ? 'Adicionando...' : 'Adicionar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setAddingMember(false); setNewMemberUserId(''); }}
                      className="h-6 px-1.5 text-[var(--mtech-text-subtle)]"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Members list */}
              {membersLoading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-10 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <p className="text-xs text-[var(--mtech-text-subtle)] py-3 text-center">
                  Nenhum membro adicionado.
                </p>
              ) : (
                <ul className="space-y-1">
                  {members.map((member) => (
                    <li
                      key={member.user_id}
                      className="group flex items-center gap-2 py-1.5 px-2 rounded-[var(--mtech-radius-sm)] hover:bg-[var(--mtech-surface-elev)] transition-colors"
                    >
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none flex-shrink-0">
                        {member.user_name ? getInitials(member.user_name) : '??'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--mtech-text)] truncate">
                          {member.user_name ?? 'Removido'}
                        </p>
                        <p className="text-[10px] text-[var(--mtech-text-subtle)]">
                          {PROJECT_MEMBER_ROLE_LABEL[member.role as ProjectMemberRole] ?? member.role}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          value={member.allocated_hours_week}
                          onChange={(e) => handleHoursChange(member.user_id, Number(e.target.value))}
                          className={`${inputCls} h-6 w-12 text-[10px] text-center p-0`}
                          title="Horas/semana"
                        />
                        <span className="text-[9px] text-[var(--mtech-text-subtle)]">h/s</span>
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--mtech-danger)] hover:text-[var(--mtech-danger)]/80 transition-all p-0.5"
                          title="Remover membro"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Total allocated hours */}
            {members.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--mtech-border)]">
                <Clock className="h-3 w-3 text-[var(--mtech-text-subtle)]" />
                <span className="text-[10px] text-[var(--mtech-text-subtle)]">
                  Total alocado:{' '}
                  <span data-mono className="text-[var(--mtech-text-muted)] font-semibold">
                    {members.reduce((sum, m) => sum + m.allocated_hours_week, 0)}h/sem
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--mtech-border)]">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleViewInKanban}
            className="text-[var(--mtech-accent)] hover:text-[var(--mtech-accent)]/80 h-8 text-xs gap-1.5"
          >
            <ExternalLink className="h-3 w-3" />
            Ver tasks no Kanban
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] h-8 text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>

      <TaskFormModal
        open={showTaskForm}
        onOpenChange={handleTaskFormClose}
        defaultProjectId={project.id}
      />
    </Dialog>
  );
}
