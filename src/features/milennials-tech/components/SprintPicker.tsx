import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTechSprints } from '../hooks/useTechSprints';
import type { TechSprintStatus } from '../types';

interface SprintPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
}

const STATUS_BADGE: Record<TechSprintStatus, { label: string; color: string; bg: string }> = {
  PLANNING: { label: 'Planejamento', color: '#8A8A95', bg: 'rgba(138,138,149,0.12)' },
  ACTIVE: { label: 'Ativa', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  COMPLETED: { label: 'Concluída', color: 'var(--mtech-text-subtle)', bg: 'rgba(90,90,102,0.12)' },
};

export function SprintPicker({ value, onChange }: SprintPickerProps) {
  const { data: sprints, isLoading } = useTechSprints();

  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? null : v)}
    >
      <SelectTrigger
        className="border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)] text-sm h-9"
      >
        <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecionar sprint'} />
      </SelectTrigger>
      <SelectContent className="border border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)] shadow-xl z-50">
        <SelectItem value="__none__" className="text-sm text-[var(--mtech-text-muted)]">
          Sem sprint
        </SelectItem>
        {sprints?.map((sprint) => {
          const badge = STATUS_BADGE[sprint.status];
          return (
            <SelectItem key={sprint.id} value={sprint.id} className="text-sm">
              <span className="flex items-center gap-2">
                <span>{sprint.name}</span>
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
                  style={{ color: badge.color, backgroundColor: badge.bg }}
                >
                  {badge.label}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
