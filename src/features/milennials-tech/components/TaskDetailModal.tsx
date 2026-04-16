import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bug,
  Sparkles,
  Flame,
  Wrench,
  Lock,
  Unlock,
  Trash2,
  Send,
  Check,
  X,
  GitBranch,
  Pencil,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTechTasks, useUpdateTechTask, useDeleteTechTask } from '../hooks/useTechTasks';
import { useTechTaskActivities } from '../hooks/useTechTaskActivities';
import { useTechTimer } from '../hooks/useTechTimer';
import { canEditTask, canApprove } from '../lib/permissions';
import { TYPE_LABEL_FRIENDLY, STATUS_LABEL_PT, PRIORITY_LABEL_FRIENDLY, ACTIVITY_LABEL } from '../lib/statusLabels';
import { TimerButton } from './TimerButton';
import { useProfileMap } from '../hooks/useProfiles';
import type { TechTask, TechTaskType, TechTaskPriority, ChecklistItem } from '../types';

interface TaskDetailModalProps {
  taskId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<TechTaskType, typeof Bug> = {
  BUG: Bug,
  FEATURE: Sparkles,
  HOTFIX: Flame,
  CHORE: Wrench,
};

const TYPE_COLOR: Record<TechTaskType, string> = {
  BUG: '#E5484D',
  FEATURE: '#3B82F6',
  HOTFIX: '#F97316',
  CHORE: '#8A8A95',
};

const PRIORITY_DOT: Record<TechTaskPriority, string> = {
  CRITICAL: 'var(--mtech-accent)',
  HIGH: '#E5484D',
  MEDIUM: '#EAB308',
  LOW: '#5A5A66',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskDetailModal({ taskId, open, onOpenChange, onClose }: TaskDetailModalProps) {
  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };
  const { user } = useAuth();
  const profileMap = useProfileMap();
  const { data: tasks } = useTechTasks();
  const { data: activities } = useTechTaskActivities(taskId);
  const { sendToReview, approve, reject, block, unblock } = useTechTimer();
  const updateTask = useUpdateTechTask();
  const deleteTask = useDeleteTechTask();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);

  const task: TechTask | undefined = tasks?.find((t) => t.id === taskId);

  const isExec = canApprove(user?.role);
  const canEdit = task ? canEditTask(user?.id ?? null, user?.role, task, []) : false;

  const handleTitleSave = useCallback(() => {
    if (!task || !titleDraft.trim()) return;
    updateTask.mutate({ id: task.id, patch: { title: titleDraft.trim() } });
    setIsEditingTitle(false);
  }, [task, titleDraft, updateTask]);

  const handleBlock = useCallback(() => {
    if (!task) return;
    block.mutate({ id: task.id, reason: blockReason || 'Bloqueada' });
    setShowBlockInput(false);
    setBlockReason('');
  }, [task, blockReason, block]);

  if (!task) {
    return (
      <Dialog open={open !== false} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="mtech-scope border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--mtech-text)]">Task</DialogTitle>
            <DialogDescription className="text-[var(--mtech-text-subtle)]">
              Carregando...
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-[var(--mtech-text-muted)]">Carregando task...</p>
        </DialogContent>
      </Dialog>
    );
  }

  const TypeIcon = TYPE_ICON[task.type];
  const checklist = (task.checklist as ChecklistItem[] | null) ?? [];

  return (
    <Dialog open={open !== false} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="mtech-scope max-w-4xl max-h-[85vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogDescription className="sr-only">
            Detalhes da task {task.title}
          </DialogDescription>
          {/* Title -- editable */}
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] text-lg font-semibold"
              />
              <Button
                size="sm"
                onClick={handleTitleSave}
                className="bg-[var(--mtech-accent)] text-black h-8"
              >
                Salvar
              </Button>
            </div>
          ) : (
            <DialogTitle
              className="group/title flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--mtech-text)] cursor-pointer hover:text-[var(--mtech-accent)] transition-colors"
              onClick={() => {
                if (canEdit) {
                  setTitleDraft(task.title);
                  setIsEditingTitle(true);
                }
              }}
            >
              {task.title}
              {canEdit && (
                <Pencil className="h-3.5 w-3.5 text-[var(--mtech-text-subtle)] opacity-0 group-hover/title:opacity-100 transition-opacity" />
              )}
            </DialogTitle>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-4">
          {/* -------- LEFT SECTION -------- */}
          <div className="space-y-5 min-w-0">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
                style={{
                  color: TYPE_COLOR[task.type],
                  backgroundColor: `${TYPE_COLOR[task.type]}1F`,
                }}
              >
                <TypeIcon className="h-3 w-3" />
                {TYPE_LABEL_FRIENDLY[task.type].label}
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--mtech-text-muted)]">
                <span
                  className="rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: PRIORITY_DOT[task.priority] }}
                />
                {PRIORITY_LABEL_FRIENDLY[task.priority].label}
              </span>

              <span className="text-xs text-[var(--mtech-text-subtle)] px-2 py-0.5 rounded-full border border-[var(--mtech-border)]">
                {STATUS_LABEL_PT[task.status]}
              </span>

              {task.is_blocked && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--mtech-danger)]">
                  <Lock className="h-3 w-3" />
                  {task.blocker_reason || 'Bloqueada'}
                </span>
              )}
            </div>

            {/* Description — render structured sections from form */}
            {task.description && (
              <div className="space-y-3">
                {task.description.split(/\n\n+/).map((block, i) => {
                  // Parse **Header:** sections
                  const headerMatch = block.match(/^\*\*(.+?):\*\*\n?([\s\S]*)$/);
                  if (headerMatch) {
                    return (
                      <div key={i}>
                        <h3 className="text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide mb-1">
                          {headerMatch[1]}
                        </h3>
                        <p className="text-sm leading-relaxed text-[var(--mtech-text)] whitespace-pre-wrap">
                          {headerMatch[2].trim()}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <p key={i} className="text-sm leading-relaxed text-[var(--mtech-text)] whitespace-pre-wrap">
                      {block}
                    </p>
                  );
                })}
              </div>
            )}

            {/* Assignee */}
            {task.assignee_id && (
              <div>
                <h3 className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide mb-1">
                  Responsável
                </h3>
                <p className="text-sm text-[var(--mtech-text)]">
                  {profileMap[task.assignee_id!] ?? task.assignee_id}
                </p>
              </div>
            )}

            {/* Acceptance criteria */}
            {task.acceptance_criteria && (
              <div>
                <h3 className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide mb-1">
                  Critérios de aceite
                </h3>
                <p className="text-sm leading-relaxed text-[var(--mtech-text)] whitespace-pre-wrap">
                  {task.acceptance_criteria}
                </p>
              </div>
            )}

            {/* Technical context */}
            {task.technical_context && (
              <div>
                <h3 className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide mb-1">
                  Contexto técnico
                </h3>
                <p className="text-sm leading-relaxed text-[var(--mtech-text)] whitespace-pre-wrap">
                  {task.technical_context}
                </p>
              </div>
            )}

            {/* Git branch */}
            {task.git_branch && (
              <div className="flex items-center gap-2 text-sm text-[var(--mtech-text-muted)]">
                <GitBranch className="h-3.5 w-3.5" />
                <code
                  data-mono
                  className="text-xs bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] rounded px-1.5 py-0.5 text-[var(--mtech-text)]"
                >
                  {task.git_branch}
                </code>
              </div>
            )}

            {/* Checklist */}
            {checklist.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide mb-2">
                  Checklist
                </h3>
                <ul className="space-y-1">
                  {checklist.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center ${
                          item.done
                            ? 'bg-[var(--mtech-accent)] border-[var(--mtech-accent)]'
                            : 'border-[var(--mtech-border-strong)]'
                        }`}
                      >
                        {item.done && <Check className="h-3 w-3 text-black" />}
                      </span>
                      <span
                        className={
                          item.done
                            ? 'line-through text-[var(--mtech-text-subtle)]'
                            : 'text-[var(--mtech-text)]'
                        }
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* -------- RIGHT SECTION: Activity timeline -------- */}
          <div className="border-l border-[var(--mtech-border)] pl-5 space-y-4">
            <h3 className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide">
              Atividade
            </h3>

            {!activities || activities.length === 0 ? (
              <p className="text-xs text-[var(--mtech-text-subtle)]">Nenhuma atividade registrada.</p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="relative pl-4 border-l-2 border-[var(--mtech-border)]">
                    <span className="absolute left-[-5px] top-1 h-2 w-2 rounded-full bg-[var(--mtech-border-strong)]" />
                    <p className="text-xs font-medium text-[var(--mtech-text)]">
                      {ACTIVITY_LABEL[a.type] ?? a.type}
                      {a.type === 'status_changed' && a.data && typeof a.data === 'object' && 'from' in a.data && 'to' in a.data && (
                        <span className="font-normal text-[var(--mtech-text-muted)]">
                          {' '}({STATUS_LABEL_PT[(a.data as {from: string}).from as keyof typeof STATUS_LABEL_PT] ?? (a.data as {from: string}).from} → {STATUS_LABEL_PT[(a.data as {to: string}).to as keyof typeof STATUS_LABEL_PT] ?? (a.data as {to: string}).to})
                        </span>
                      )}
                    </p>
                    <time
                      data-mono
                      className="text-[10px] text-[var(--mtech-text-subtle)]"
                      dateTime={a.created_at}
                    >
                      {new Date(a.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* -------- ACTIONS -------- */}
        <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-[var(--mtech-border)]">
          {/* Timer */}
          <TimerButton taskId={task.id} />

          {/* Send to Review */}
          {canEdit && task.status === 'IN_PROGRESS' && (
            <Button
              size="sm"
              onClick={() => sendToReview.mutate(task.id, { onSuccess: () => toast.success('Enviada para review') })}
              disabled={sendToReview.isPending}
              className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[var(--mtech-text)] hover:border-[var(--mtech-border-strong)] h-8 text-xs gap-1.5"
            >
              <Send className="h-3 w-3" />
              Enviar p/ Review
            </Button>
          )}

          {/* Approve (exec only) */}
          {isExec && task.status === 'REVIEW' && (
            <Button
              size="sm"
              onClick={() => approve.mutate(task.id, { onSuccess: () => toast.success('Task aprovada') })}
              disabled={approve.isPending}
              className="bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/30 h-8 text-xs gap-1.5"
            >
              <Check className="h-3 w-3" />
              Aprovar
            </Button>
          )}

          {/* Reject (exec only) */}
          {isExec && task.status === 'REVIEW' && (
            <Button
              size="sm"
              onClick={() => reject.mutate(task.id, { onSuccess: () => toast.info('Task devolvida para desenvolvimento') })}
              disabled={reject.isPending}
              className="bg-[var(--mtech-danger)]/10 border border-[var(--mtech-danger)]/30 text-[var(--mtech-danger)] hover:bg-[var(--mtech-danger)]/20 h-8 text-xs gap-1.5"
            >
              <X className="h-3 w-3" />
              Rejeitar
            </Button>
          )}

          {/* Block / Unblock */}
          {canEdit && !task.is_blocked && (
            <>
              {showBlockInput ? (
                <span className="inline-flex items-center gap-1">
                  <Input
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Motivo..."
                    className="h-8 w-40 text-xs bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleBlock();
                      if (e.key === 'Escape') setShowBlockInput(false);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleBlock}
                    disabled={block.isPending}
                    className="bg-[var(--mtech-danger)]/10 border border-[var(--mtech-danger)]/30 text-[var(--mtech-danger)] h-8 text-xs"
                  >
                    Bloquear
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setShowBlockInput(true)}
                  className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-danger)] h-8 text-xs gap-1.5"
                >
                  <Lock className="h-3 w-3" />
                  Bloquear
                </Button>
              )}
            </>
          )}

          {canEdit && task.is_blocked && (
            <Button
              size="sm"
              onClick={() => unblock.mutate(task.id, { onSuccess: () => toast.success('Task desbloqueada') })}
              disabled={unblock.isPending}
              className="bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[var(--mtech-accent)] hover:border-[var(--mtech-accent)] h-8 text-xs gap-1.5"
            >
              <Unlock className="h-3 w-3" />
              Desbloquear
            </Button>
          )}

          {/* Delete (exec only) — with confirmation */}
          {isExec && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={deleteTask.isPending}
                  className="ml-auto bg-transparent border border-[var(--mtech-border)] text-[var(--mtech-danger)] hover:bg-[var(--mtech-danger)]/10 h-8 text-xs gap-1.5"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mtech-scope border-[var(--mtech-border)] bg-[var(--mtech-surface)]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[var(--mtech-text)]">Excluir task?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[var(--mtech-text-muted)]">
                    Essa ação não pode ser desfeita. A task &quot;{task.title}&quot; será permanentemente removida.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-[var(--mtech-border)] text-[var(--mtech-text-muted)]">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteTask.mutate(task.id, {
                        onSuccess: () => {
                          toast.success('Task excluída');
                          handleClose();
                        },
                      });
                    }}
                    className="bg-[var(--mtech-danger)] text-white hover:bg-[var(--mtech-danger)]/80"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
