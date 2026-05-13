import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { RequiredField } from '@/hooks/useCrmStepValidation';

interface Props {
  fields: RequiredField[];
  values: Record<string, string>;
  onSave: (key: string, value: string) => void;
  disabled?: boolean;
}

/**
 * Renders required fields by type (datetime, text, boolean, url).
 * Saves on blur for text/datetime/url, immediately for boolean.
 */
export default function CrmRequiredFields({ fields, values, onSave, disabled }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        Campos obrigatorios
      </p>

      <div className="space-y-3">
        {fields.map(field => {
          const value = values[field.key] || '';
          const filled = value.trim() !== '';

          return (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                {field.label}
                {!filled && (
                  <span className="text-[10px] text-destructive font-normal">*</span>
                )}
              </label>

              {field.type === 'boolean' ? (
                <label className={cn(
                  'flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all',
                  value === 'true'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-background border-border',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}>
                  <Checkbox
                    checked={value === 'true'}
                    onCheckedChange={(v) => !disabled && onSave(field.key, v ? 'true' : '')}
                    disabled={disabled}
                  />
                  <span className="text-sm">Sim</span>
                </label>
              ) : field.type === 'datetime' ? (
                <Input
                  type="datetime-local"
                  value={value}
                  onChange={(e) => onSave(field.key, e.target.value)}
                  disabled={disabled}
                  className={cn(
                    'h-9 text-sm',
                    filled && 'border-emerald-500/30'
                  )}
                />
              ) : field.type === 'url' ? (
                <Input
                  type="url"
                  value={value}
                  placeholder="https://..."
                  onBlur={(e) => onSave(field.key, e.target.value)}
                  onChange={(e) => {
                    // Controlled but only save on blur
                    const input = e.target;
                    input.dataset.pendingValue = e.target.value;
                  }}
                  disabled={disabled}
                  className={cn(
                    'h-9 text-sm',
                    filled && 'border-emerald-500/30'
                  )}
                />
              ) : (
                // text
                <Input
                  type="text"
                  value={value}
                  placeholder="..."
                  onChange={(e) => onSave(field.key, e.target.value)}
                  disabled={disabled}
                  className={cn(
                    'h-9 text-sm',
                    filled && 'border-emerald-500/30'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
