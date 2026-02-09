import { User, Clock, Timer, MoreVertical, Archive, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { KanbanCard } from '@/hooks/useKanban';
import { cn } from '@/lib/utils';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
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
}

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-success/10 text-success border-success/20' },
  medium: { label: 'Média', color: 'bg-info/10 text-info border-info/20' },
  high: { label: 'Alta', color: 'bg-warning/10 text-warning border-warning/20' },
  urgent: { label: 'Urgente', color: 'bg-danger/10 text-danger border-danger/20' },
};

export default function KanbanCardItem({ 
  card, 
  onClick, 
  onArchive,
  onDelete,
  onJustify,
  showClientTimer = true,
  showActions = true 
}: KanbanCardItemProps) {
  const { user, isCEO, isAdminUser } = useAuth();
  const canSetClientLabel = !!(isCEO || isAdminUser || user?.role === 'sucesso_cliente' || user?.role === 'gestor_projetos');

  const priority = priorityConfig[card.priority];
  const isOverdue = card.due_date && isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));
  const isDueToday = card.due_date && isToday(new Date(card.due_date));
  const hasJustification = Boolean(card.justification);
  
  // Calculate days since client creation (if client data is available)
  const clientCreatedAt = card.client?.created_at || card.created_at;
  const daysSinceCreation = differenceInDays(new Date(), new Date(clientCreatedAt));

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "kanban-card group cursor-pointer relative",
        "bg-card border border-border rounded-xl p-4",
        "hover:border-primary/30 hover:shadow-lg",
        "transition-all duration-200"
      )}
    >
      {/* Actions Menu (3 dots) */}
      {showActions && (onArchive || onDelete) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-background/80 backdrop-blur-sm hover:bg-muted border border-border/50 transition-colors"
              >
                <MoreVertical size={14} className="text-muted-foreground" />
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
        </div>
      )}

      {/* Priority Badge & Client Timer */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
            priority.color
          )}>
            {priority.label}
          </span>
          {showClientTimer && (
            <span className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
              daysSinceCreation > 7 ? "bg-warning/10 text-warning" : "bg-info/10 text-info"
            )}>
              <Timer size={10} />
              {daysSinceCreation} {daysSinceCreation === 1 ? 'dia' : 'dias'}
            </span>
          )}

          {/* Client label badge (visible to everyone) */}
          {card.client && (
            <ClientLabelBadge
              label={(card.client.client_label as ClientLabel) ?? null}
              size="sm"
              className="shrink-0"
            />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Client label selector (only allowed roles) */}
          {canSetClientLabel && card.client?.id && (
            <ClientLabelSelector
              clientId={card.client.id}
              currentLabel={(card.client.client_label as ClientLabel) ?? null}
            />
          )}

          {card.progress > 0 && card.progress < 100 && (
            <span className="text-[10px] font-medium text-muted-foreground">
              {card.progress}%
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm text-foreground leading-snug mb-2 line-clamp-2 pr-6">
        {card.title}
      </h4>

      {/* Description */}
      {card.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {card.description}
        </p>
      )}

      {/* Progress Bar */}
      {card.progress > 0 && (
        <div className="mb-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                card.progress === 100 ? "bg-success" : "bg-primary"
              )}
              style={{ width: `${card.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {card.tags.slice(0, 3).map((tag, index) => (
            <span 
              key={index}
              className="px-2 py-0.5 bg-muted rounded text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {card.tags.length > 3 && (
            <span className="px-2 py-0.5 text-[10px] text-muted-foreground">
              +{card.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Overdue Justification Badge */}
      {isOverdue && (
        <div className="mb-3">
          {hasJustification ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 text-success text-[10px] font-medium cursor-help">
                    <CheckCircle2 size={12} />
                    Justificado
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p className="text-xs">{card.justification}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}

        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        {/* Due Date */}
        {card.due_date ? (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-medium",
            isOverdue ? "text-danger" : isDueToday ? "text-warning" : "text-muted-foreground"
          )}>
            <Clock size={12} />
            <span>
              {isOverdue ? 'Atrasado' : isDueToday ? 'Hoje' : format(new Date(card.due_date), 'dd MMM', { locale: ptBR })}
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* Assignee */}
        {card.assignee ? (
          <div 
            className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-[10px] font-semibold"
            title={card.assignee.name}
          >
            {card.assignee.avatar ? (
              <img 
                src={card.assignee.avatar} 
                alt={card.assignee.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              card.assignee.name.charAt(0)
            )}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
            <User size={12} className="text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
