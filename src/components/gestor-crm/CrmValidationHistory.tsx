import { useState } from 'react';
import { useCrmValidationLog, type ValidationLogEntry } from '@/hooks/useCrmValidationLog';
import { CRM_STEP_LABEL } from '@/hooks/useCrmKanban';
import { History, ChevronDown, ChevronUp, CheckSquare, RotateCcw, ArrowRight, Shield, FileText, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  configId: string;
}

const ACTION_META: Record<string, {
  label: string;
  icon: typeof History;
  color: string;
}> = {
  checklist_toggle: { label: 'Checklist', icon: CheckSquare, color: 'text-blue-600' },
  advance: { label: 'Avancou', icon: ArrowRight, color: 'text-emerald-600' },
  reset_loop: { label: 'Reset', icon: RotateCcw, color: 'text-amber-600' },
  blocked: { label: 'Bloqueado', icon: Shield, color: 'text-destructive' },
  field_save: { label: 'Campo', icon: FileText, color: 'text-violet-600' },
  delay_justification: { label: 'Justificativa', icon: Send, color: 'text-orange-600' },
  finalized: { label: 'Finalizado', icon: CheckCircle2, color: 'text-emerald-700' },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function describeEntry(entry: ValidationLogEntry): string {
  const details = entry.details || {};
  switch (entry.action) {
    case 'checklist_toggle': {
      const item = details.item as string || '';
      const checked = details.checked;
      return checked ? `Marcou: ${item}` : `Desmarcou: ${item}`;
    }
    case 'advance': {
      const next = details.next_step as string || '';
      return `Proxima etapa: ${CRM_STEP_LABEL[next] || next}`;
    }
    case 'reset_loop': {
      const reason = details.reason as string || '';
      const failedItems = details.failed_items as string[] | undefined;
      let desc = reason;
      if (failedItems && failedItems.length > 0) {
        desc += ` | Itens: ${failedItems.join(', ')}`;
      }
      return desc;
    }
    case 'blocked': {
      const blockers = details.blockers as string[] || [];
      return blockers.join('; ');
    }
    case 'field_save': {
      const key = details.key as string || '';
      return `Salvo: ${key}`;
    }
    case 'delay_justification': {
      const j = details.justification as string || '';
      return j.length > 80 ? j.slice(0, 80) + '...' : j;
    }
    case 'finalized':
      return 'Configuracao finalizada';
    default:
      return JSON.stringify(details);
  }
}

/**
 * Collapsible history section showing all validation log entries.
 * Displayed inside CrmConfigViewModal / CrmValidationGate full mode.
 */
export default function CrmValidationHistory({ configId }: Props) {
  const { data: logs = [], isLoading } = useCrmValidationLog(configId);
  const [expanded, setExpanded] = useState(false);

  // Filter out blocked entries (noise) — only show meaningful actions
  const filtered = logs.filter(l => l.action !== 'blocked');

  if (isLoading) {
    return <div className="h-8 bg-muted/30 rounded animate-pulse" />;
  }

  if (filtered.length === 0) {
    return null;
  }

  const preview = filtered.slice(0, 3);
  const remaining = filtered.slice(3);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold hover:text-foreground transition-colors w-full"
      >
        <History size={12} />
        Historico ({filtered.length})
        {remaining.length > 0 && (
          expanded ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />
        )}
      </button>

      <div className="space-y-1">
        {preview.map(entry => (
          <LogRow key={entry.id} entry={entry} />
        ))}
        {expanded && remaining.map(entry => (
          <LogRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: ValidationLogEntry }) {
  const meta = ACTION_META[entry.action] || { label: entry.action, icon: History, color: 'text-muted-foreground' };
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-2 text-[11px] py-1.5 px-2 rounded-md bg-muted/20 border border-border/30">
      <Icon size={11} className={cn('mt-0.5 shrink-0', meta.color)} />
      <div className="flex-1 min-w-0">
        <span className={cn('font-semibold', meta.color)}>{meta.label}</span>
        <span className="text-muted-foreground mx-1">—</span>
        <span className="text-foreground/80">{describeEntry(entry)}</span>
      </div>
      <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
        {entry.performer_name && (
          <span className="mr-1.5">{entry.performer_name}</span>
        )}
        {formatTimestamp(entry.created_at)}
      </div>
    </div>
  );
}
