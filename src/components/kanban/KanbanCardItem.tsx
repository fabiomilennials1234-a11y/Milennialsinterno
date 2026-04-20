import { Clock, MoreVertical, Archive, Trash2, AlertTriangle, CheckCircle2, Flag, User } from 'lucide-react';
import { KanbanCard } from '@/hooks/useKanban';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KanbanCardItemProps {
  card: KanbanCard;
  onClick?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onJustify?: () => void;
  showClientTimer?: boolean;
  showActions?: boolean;
  isFocused?: boolean;
}

// Gradient determinístico por hash do nome (estilo Linear/Height).
function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 40) % 360} 62% 42%))`;
}

const priorityMeta = {
  low: { label: 'Baixa', tone: 'text-muted-foreground/60' },
  medium: { label: 'Média', tone: 'text-muted-foreground/60' },
  high: { label: 'Alta', tone: 'text-warning' },
  urgent: { label: 'Urgente', tone: 'text-danger' },
} as const;

// Timestamp relativo curto ("há 3d", "há 5h"), estilo lista de leads da referência.
function relativeShort(date: Date): string {
  const full = formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
  return full.replace('há cerca de ', 'há ').replace('há menos de ', 'há ');
}

export default function KanbanCardItem({
  card,
  onClick,
  onArchive,
  onDelete,
  onJustify,
  showClientTimer = true,
  showActions = true,
  isFocused = false,
}: KanbanCardItemProps) {
  const { user, isCEO, isAdminUser } = useAuth();
  const canSetClientLabel = !!(
    isCEO ||
    isAdminUser ||
    user?.role === 'sucesso_cliente' ||
    user?.role === 'gestor_projetos'
  );

  const prio = priorityMeta[card.priority];
  const showPriorityFlag = card.priority === 'high' || card.priority === 'urgent';

  const dueDate = card.due_date ? new Date(card.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
  const isDueToday = dueDate && isToday(dueDate);
  const hasJustification = Boolean(card.justification);

  const assigneeName = card.assignee?.name || '';
  const tags = (card.tags && card.tags.length > 0) ? card.tags : [];
  const createdAt = card.created_at ? new Date(card.created_at) : null;

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const hasStructuredFields = Boolean(
    (card.progress && card.progress > 0) || showPriorityFlag || dueDate
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "kanban-card group cursor-pointer relative",
        "bg-card border border-border rounded-xl p-3.5",
        isFocused && "kanban-card-focused"
      )}
    >
      {/* Tags + 3-dots menu */}
      <div className="flex items-start justify-between gap-2 mb-2 min-h-[20px]">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {tags.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/70 text-[11px] font-medium text-foreground/75"
            >
              {tag}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="text-[11px] font-medium text-muted-foreground/70">
              +{tags.length - 2}
            </span>
          )}
          {card.client && (
            <ClientLabelBadge
              label={(card.client.client_label as ClientLabel) ?? null}
              size="sm"
              className="shrink-0"
            />
          )}
        </div>

        {/* Menu 3-dots sempre visível, não só em hover */}
        {showActions && (onArchive || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 -mt-0.5 -mr-0.5"
                aria-label="Ações do card"
              >
                <MoreVertical size={15} strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {onArchive && (
                <DropdownMenuItem onClick={handleArchive} className="gap-2 cursor-pointer">
                  <Archive size={14} />
                  Arquivar
                </DropdownMenuItem>
              )}
              {onArchive && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 size={14} />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Título grande, peso forte */}
      <h4 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground leading-[1.3] line-clamp-2 mb-1">
        {card.title}
      </h4>

      {/* Descrição / subtítulo */}
      {card.description && (
        <p className="text-[12.5px] text-muted-foreground leading-[1.45] line-clamp-2 mb-3">
          {card.description}
        </p>
      )}

      {/* Campos estruturados em grid 2-col — estilo Attio */}
      {hasStructuredFields && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3 pt-2 border-t border-border/40">
          {showPriorityFlag && (
            <div>
              <div className="text-[10.5px] font-medium text-muted-foreground/70 mb-0.5 tracking-[0.01em] uppercase">
                Prioridade
              </div>
              <div className={cn("inline-flex items-center gap-1 text-[12.5px] font-semibold", prio.tone)}>
                <Flag size={11} strokeWidth={2.5} fill="currentColor" />
                {prio.label}
              </div>
            </div>
          )}

          {dueDate && (
            <div>
              <div className="text-[10.5px] font-medium text-muted-foreground/70 mb-0.5 tracking-[0.01em] uppercase">
                Entrega
              </div>
              <div className={cn(
                "inline-flex items-center gap-1 text-[12.5px] font-semibold",
                isOverdue && !hasJustification
                  ? "text-danger"
                  : isDueToday
                    ? "text-warning"
                    : "text-foreground/85"
              )}>
                {isOverdue && !hasJustification ? (
                  <AlertTriangle size={11} strokeWidth={2.5} />
                ) : (
                  <Clock size={11} strokeWidth={2.5} />
                )}
                {isOverdue
                  ? 'Atrasado'
                  : isDueToday
                    ? 'Hoje'
                    : format(dueDate, 'dd MMM', { locale: ptBR })}
              </div>
            </div>
          )}

          {card.progress > 0 && (
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10.5px] font-medium text-muted-foreground/70 tracking-[0.01em] uppercase">
                  Progresso
                </div>
                <div className="text-[11px] font-semibold text-foreground tabular-nums">
                  {card.progress}%
                </div>
              </div>
              <div className="h-1 bg-border/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    card.progress === 100
                      ? "bg-success"
                      : card.progress < 25
                        ? "bg-danger/70"
                        : card.progress > 75
                          ? "bg-success"
                          : "bg-primary"
                  )}
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Justificativa de atraso */}
      {isOverdue && hasJustification && (
        <div className="mb-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-success/12 text-success text-[11px] font-medium cursor-help">
                  <CheckCircle2 size={12} />
                  Justificado
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px]">
                <p className="text-xs">{card.justification}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Footer: assignee + timestamp relativo */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          {card.assignee ? (
            <>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold ring-1 ring-background shadow-sm overflow-hidden shrink-0"
                style={!card.assignee.avatar ? { background: avatarGradient(assigneeName) } : undefined}
                title={assigneeName}
              >
                {card.assignee.avatar ? (
                  <img src={card.assignee.avatar} alt={assigneeName} className="w-5 h-5 object-cover" />
                ) : (
                  assigneeName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-[12px] text-muted-foreground truncate">{assigneeName}</span>
            </>
          ) : card.client ? (
            <span className="text-[12px] text-muted-foreground truncate">{card.client.name}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground/60">
              <User size={11} strokeWidth={2} />
              Sem responsável
            </span>
          )}
        </div>

        {createdAt && showClientTimer && (
          <span className="text-[11px] text-muted-foreground/70 shrink-0">
            {relativeShort(createdAt)}
          </span>
        )}
      </div>

      {/* onJustify é disponível como prop mas acionado via modal externo */}
      {false && onJustify && <span />}
    </div>
  );
}
