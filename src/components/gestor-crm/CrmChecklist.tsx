import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface Props {
  items: string[];
  state: Record<string, boolean>;
  onToggle: (item: string, checked: boolean) => void;
  disabled?: boolean;
}

/**
 * Renders a checklist with checkbox + counter (2/4).
 * Each item is toggleable. Visual feedback for complete vs incomplete.
 */
export default function CrmChecklist({ items, state, onToggle, disabled }: Props) {
  const completed = items.filter(i => state[i]).length;
  const total = items.length;
  const allDone = completed === total;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          Checklist
        </p>
        <span className={cn(
          'text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded',
          allDone
            ? 'bg-success/10 text-success'
            : 'bg-muted text-muted-foreground'
        )}>
          {completed}/{total}
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map(item => {
          const checked = !!state[item];
          return (
            <label
              key={item}
              className={cn(
                'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all',
                checked
                  ? 'bg-success/5 border-success/20'
                  : 'bg-background border-border hover:border-primary/30',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => !disabled && onToggle(item, !!v)}
                disabled={disabled}
                className="mt-0.5"
              />
              <span className={cn(
                'text-sm leading-snug',
                checked && 'line-through text-muted-foreground'
              )}>
                {item}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
