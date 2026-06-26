import { useMemo, useState, type ReactNode } from 'react';
import {
  Search,
  Check,
  ChevronDown,
  FolderKanban,
  Building2,
  Users,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { getInitials } from '../hooks/useProfiles';
import {
  ISSUE_STATUS_CONFIG,
  ISSUE_TYPE_CONFIG,
  epicColorFromKey,
  type IssueStatus,
  type IssueType,
} from '../lib/issueSystem';
import { IssueTypeBadge } from './IssueTypeBadge';
import {
  activeFilterCount,
  SQUAD_CONFIG,
  SQUAD_ORDER,
  type AssigneeOption,
  type BacklogFilters,
  type ClientOption,
  type IssueSquad,
  type ProjectOption,
} from './backlogTypes';

// ---------------------------------------------------------------------------
// BacklogFilterBar — dense, multi-select filtering across the whole backlog.
//
// One compact row: search on the left, a dimension pill per axis (Project /
// Client / Squad / Assignee / Type / Status), active-count + clear on the
// right. Each pill is a checkable Popover (multi-select). The whole pill row
// collapses behind a toggle so it never shoves the queue down on a tight view.
//
// Pure presentational: option lists + filter state in, onChange out.
// ---------------------------------------------------------------------------

export interface BacklogFilterBarProps {
  projects: ProjectOption[];
  clients: ClientOption[];
  assignees: AssigneeOption[];
  filters: BacklogFilters;
  onChange: (next: BacklogFilters) => void;
  className?: string;
}

interface Option {
  id: string;
  label: string;
  leading?: ReactNode;
}

const TYPE_ORDER: IssueType[] = ['STORY', 'BUG', 'TASK'];
const STATUS_ORDER = Object.keys(ISSUE_STATUS_CONFIG) as IssueStatus[];

// --- generic multi-select pill ---------------------------------------------

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function MiniAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  return (
    <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[8px] font-bold text-[var(--mtech-accent)]">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

function FilterMultiSelect({
  label,
  icon,
  options,
  selected,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const count = selected.length;
  const active = count > 0;
  const searchable = options.length > 8;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar por ${label}`}
          className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--mtech-radius-sm)] border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] ${
            active
              ? 'border-[var(--mtech-accent)]/40 bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)]'
              : 'border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text)]'
          }`}
        >
          {icon}
          {label}
          {active && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--mtech-accent)] px-1 text-[10px] font-bold tabular-nums text-black">
              {count}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="mtech-scope w-60 border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] p-0 text-[var(--mtech-text)]"
        style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}
      >
        {searchable && (
          <div className="border-b border-[var(--mtech-border)] p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--mtech-text-subtle)]" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}...`}
                className="h-8 border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] pl-8 text-[12px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
              />
            </div>
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-[12px] text-[var(--mtech-text-subtle)]">
              Nada encontrado
            </p>
          ) : (
            filtered.map((opt) => {
              const isOn = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isOn}
                  onClick={() => toggle(opt.id)}
                  className="flex w-full items-center gap-2 rounded-[var(--mtech-radius-sm)] px-2 py-1.5 text-left text-[12px] text-[var(--mtech-text-muted)] transition-colors hover:bg-[var(--mtech-surface)] hover:text-[var(--mtech-text)] focus-visible:outline-none focus-visible:bg-[var(--mtech-surface)]"
                >
                  <span
                    aria-hidden
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                      isOn
                        ? 'border-[var(--mtech-accent)] bg-[var(--mtech-accent)]'
                        : 'border-[var(--mtech-border-strong)]'
                    }`}
                  >
                    {isOn && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
                  </span>
                  {opt.leading}
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
        {active && (
          <div className="border-t border-[var(--mtech-border)] p-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full rounded-[var(--mtech-radius-sm)] px-2 py-1.5 text-left text-[11px] font-medium text-[var(--mtech-text-subtle)] transition-colors hover:bg-[var(--mtech-surface)] hover:text-[var(--mtech-text)]"
            >
              Limpar {label.toLowerCase()}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// --- component --------------------------------------------------------------

export function BacklogFilterBar({
  projects,
  clients,
  assignees,
  filters,
  onChange,
  className = '',
}: BacklogFilterBarProps) {
  const [expanded, setExpanded] = useState(true);
  const activeCount = activeFilterCount(filters);

  const set = <K extends keyof BacklogFilters>(key: K, value: BacklogFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const projectOptions: Option[] = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        label: p.name,
        leading: <Dot color={epicColorFromKey(p.prefix)} />,
      })),
    [projects],
  );

  const clientOptions: Option[] = useMemo(
    () => clients.map((c) => ({ id: c.id, label: c.name })),
    [clients],
  );

  const assigneeOptions: Option[] = useMemo(
    () =>
      assignees.map((a) => ({
        id: a.id,
        label: a.name,
        leading: <MiniAvatar name={a.name} avatarUrl={a.avatarUrl} />,
      })),
    [assignees],
  );

  const squadOptions: Option[] = SQUAD_ORDER.map((s) => ({
    id: s,
    label: SQUAD_CONFIG[s].label,
    leading: <Dot color={SQUAD_CONFIG[s].color} />,
  }));

  const typeOptions: Option[] = TYPE_ORDER.map((t) => ({
    id: t,
    label: ISSUE_TYPE_CONFIG[t].label,
    leading: <IssueTypeBadge type={t} size="sm" />,
  }));

  const statusOptions: Option[] = STATUS_ORDER.map((s) => ({
    id: s,
    label: ISSUE_STATUS_CONFIG[s].label,
    leading: <Dot color={ISSUE_STATUS_CONFIG[s].color} />,
  }));

  return (
    <div className={`mtech-scope flex flex-wrap items-center gap-2 ${className}`}>
      {/* Search */}
      <div className="relative w-full max-w-xs sm:w-auto sm:flex-1 sm:min-w-[220px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mtech-text-subtle)]" />
        <Input
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Buscar por título ou chave..."
          className="h-8 border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] pl-9 text-[13px] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
        />
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[var(--mtech-radius-sm)] border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] ${
          activeCount > 0 && !expanded
            ? 'border-[var(--mtech-accent)]/40 bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)]'
            : 'border-[var(--mtech-input-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text)]'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        Filtros
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--mtech-accent)] px-1 text-[10px] font-bold tabular-nums text-black">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dimension pills */}
      {expanded && (
        <>
          <span aria-hidden className="hidden h-5 w-px bg-[var(--mtech-border)] sm:block" />

          {projectOptions.length > 0 && (
            <FilterMultiSelect
              label="Projeto"
              icon={<FolderKanban className="h-3.5 w-3.5" aria-hidden />}
              options={projectOptions}
              selected={filters.projectIds}
              onChange={(v) => set('projectIds', v)}
            />
          )}
          {clientOptions.length > 0 && (
            <FilterMultiSelect
              label="Cliente"
              icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}
              options={clientOptions}
              selected={filters.clientIds}
              onChange={(v) => set('clientIds', v)}
            />
          )}
          <FilterMultiSelect
            label="Squad"
            options={squadOptions}
            selected={filters.squads}
            onChange={(v) => set('squads', v as IssueSquad[])}
          />
          {assigneeOptions.length > 0 && (
            <FilterMultiSelect
              label="Responsável"
              icon={<Users className="h-3.5 w-3.5" aria-hidden />}
              options={assigneeOptions}
              selected={filters.assigneeIds}
              onChange={(v) => set('assigneeIds', v)}
            />
          )}
          <FilterMultiSelect
            label="Tipo"
            options={typeOptions}
            selected={filters.types}
            onChange={(v) => set('types', v as IssueType[])}
          />
          <FilterMultiSelect
            label="Status"
            options={statusOptions}
            selected={filters.statuses}
            onChange={(v) => set('statuses', v as IssueStatus[])}
          />
        </>
      )}

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              projectIds: [],
              clientIds: [],
              squads: [],
              assigneeIds: [],
              types: [],
              statuses: [],
              search: filters.search,
            })
          }
          className="inline-flex h-8 items-center gap-1 rounded-[var(--mtech-radius-sm)] px-2 text-[12px] font-medium text-[var(--mtech-text-subtle)] transition-colors hover:text-[var(--mtech-danger)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpar
        </button>
      )}
    </div>
  );
}
