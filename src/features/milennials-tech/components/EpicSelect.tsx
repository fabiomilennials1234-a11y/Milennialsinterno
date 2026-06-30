import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { epicColorFromKey } from '../lib/issueSystem';
import { epicsForProject } from '../lib/epicSelection';

// ---------------------------------------------------------------------------
// EpicSelect (#169) — pick the Epic an issue belongs to, scoped to the issue's
// own project. Reused in two surfaces: IssueCreateModal (initial link) and the
// issue detail (re-link / unlink). Pure presentational: epics + projectId +
// value in, onChange(epicId | null) out. The project-scoping rule lives in the
// tested `epicsForProject` helper, never in this JSX.
//
// "Sem epic" is a first-class option — picking it emits null, which the detail
// turns into an unlink. Epics are project-scoped, so with no project chosen the
// control is inert (nothing to pick from yet).
// ---------------------------------------------------------------------------

export interface EpicSelectOption {
  id: string;
  title: string;
  key: string | null;
  projectId: string;
}

export interface EpicSelectProps {
  epics: EpicSelectOption[];
  /** The issue's project. Null = no project chosen yet -> control is disabled. */
  projectId: string | null;
  /** Currently linked epic id, or null when the issue has no epic. */
  value: string | null;
  onChange: (epicId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const NONE = '__none__';

const triggerCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const contentCls =
  'mtech-scope bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50 max-h-60';

export function EpicSelect({
  epics,
  projectId,
  value,
  onChange,
  disabled = false,
  className,
}: EpicSelectProps) {
  const options = useMemo(() => epicsForProject(epics, projectId), [epics, projectId]);
  const selected = useMemo(() => options.find((e) => e.id === value) ?? null, [options, value]);

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || !projectId}
    >
      <SelectTrigger aria-label="Epic" className={`${triggerCls} ${className ?? ''}`}>
        <SelectValue placeholder={projectId ? 'Sem epic' : 'Escolha um projeto'}>
          {selected ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: epicColorFromKey(selected.key ?? selected.id) }}
              />
              <span className="truncate">{selected.title}</span>
            </span>
          ) : (
            'Sem epic'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={contentCls}>
        <SelectItem value={NONE}>Sem epic</SelectItem>
        {options.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: epicColorFromKey(e.key ?? e.id) }}
              />
              <span className="truncate">{e.title}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
