import { useState, useEffect } from 'react';
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

function DebouncedTextInput({
  fieldKey,
  serverValue,
  placeholder,
  type = 'text',
  disabled,
  onSave,
  filled,
}: {
  fieldKey: string;
  serverValue: string;
  placeholder: string;
  type?: string;
  disabled?: boolean;
  onSave: (key: string, value: string) => void;
  filled: boolean;
}) {
  const [local, setLocal] = useState(serverValue);

  useEffect(() => {
    setLocal(serverValue);
  }, [serverValue]);

  return (
    <Input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== serverValue) onSave(fieldKey, local);
      }}
      disabled={disabled}
      className={cn(
        'h-9 text-sm',
        filled && 'border-success/30'
      )}
    />
  );
}

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
                    ? 'bg-success/5 border-success/20'
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
                <DebouncedTextInput
                  fieldKey={field.key}
                  serverValue={value}
                  placeholder=""
                  type="datetime-local"
                  disabled={disabled}
                  onSave={onSave}
                  filled={filled}
                />
              ) : field.type === 'url' ? (
                <DebouncedTextInput
                  fieldKey={field.key}
                  serverValue={value}
                  placeholder="https://..."
                  type="url"
                  disabled={disabled}
                  onSave={onSave}
                  filled={filled}
                />
              ) : (
                <DebouncedTextInput
                  fieldKey={field.key}
                  serverValue={value}
                  placeholder="..."
                  disabled={disabled}
                  onSave={onSave}
                  filled={filled}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
