import { FolderPlus, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getInitials } from '../hooks/useProfiles';
import type { ProjectCreateType } from './ProjectCreateForm';

// ---------------------------------------------------------------------------
// Contract types (engineer pairs against these)
// ---------------------------------------------------------------------------

export interface ProjectListItem {
  id: string;
  name: string;
  /** Issue-key prefix, e.g. "AGS". Rendered as a mono badge. */
  key_prefix: string;
  type: ProjectCreateType;
  lead_name?: string | null;
}

export interface ProjectTracerListProps {
  projects: ProjectListItem[];
  isLoading?: boolean;
  /** Empty-state CTA + (optional) external "new" affordances. */
  onCreateClick?: () => void;
  onProjectClick?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Type badge config (aligned with ProjectCard)
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<ProjectCreateType, { color: string; bg: string; label: string }> = {
  client: { color: '#3B82F6', bg: 'rgba(59,130,246,0.14)', label: 'Cliente' },
  internal: { color: '#8A8A95', bg: 'rgba(138,138,149,0.14)', label: 'Interno' },
};

// ---------------------------------------------------------------------------
// Sub-parts
// ---------------------------------------------------------------------------

function KeyBadge({ prefix }: { prefix: string }) {
  return (
    <span
      data-mono
      className="inline-flex items-center justify-center rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--mtech-text-muted)] select-none"
    >
      {prefix}
    </span>
  );
}

function TypeBadge({ type }: { type: ProjectCreateType }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.internal;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function Lead({ name }: { name?: string | null }) {
  if (!name) {
    return (
      <div className="flex items-center gap-1.5 text-[var(--mtech-text-subtle)]">
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
          <User className="h-3 w-3" />
        </span>
        <span className="text-[11px]">Sem lead</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[9px] font-bold text-[var(--mtech-accent)] select-none">
        {getInitials(name)}
      </span>
      <span className="truncate text-[11px] text-[var(--mtech-text-muted)]">{name}</span>
    </div>
  );
}

const COL = 'grid grid-cols-[64px_1fr_160px_88px] items-center gap-3';

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function ListHeader() {
  return (
    <div
      className={`${COL} px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--mtech-text-subtle)]`}
    >
      <span>Chave</span>
      <span>Projeto</span>
      <span>Lead</span>
      <span className="text-right">Tipo</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div role="status" aria-label="Carregando projetos" className="divide-y divide-[var(--mtech-border)]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${COL} px-3 py-2.5`}>
          <div className="h-5 w-12 rounded-[var(--mtech-radius-sm)] bg-[var(--mtech-surface-elev)] animate-pulse" />
          <div
            className="h-3.5 rounded bg-[var(--mtech-surface-elev)] animate-pulse"
            style={{ width: `${55 + ((i * 13) % 35)}%` }}
          />
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" />
            <div className="h-3 w-20 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
          </div>
          <div className="h-4 w-14 justify-self-end rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
        <FolderPlus className="h-5 w-5 text-[var(--mtech-text-subtle)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--mtech-text)]">Nenhum projeto por aqui ainda</h3>
      <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--mtech-text-subtle)]">
        Crie o primeiro projeto e suas tasks ganham uma chave propria — tipo{' '}
        <span data-mono className="text-[var(--mtech-text-muted)]">AGS-1</span>.
      </p>
      {onCreateClick && (
        <Button
          size="sm"
          onClick={onCreateClick}
          className="mt-5 gap-1.5 bg-[var(--mtech-accent)] font-semibold text-black hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Criar primeiro projeto
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectTracerList({
  projects,
  isLoading = false,
  onCreateClick,
  onProjectClick,
}: ProjectTracerListProps) {
  const shell =
    'mtech-scope rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] overflow-hidden';

  if (isLoading) {
    return (
      <div className={shell} style={{ boxShadow: 'var(--mtech-shadow-card)' }}>
        <ListHeader />
        <div className="border-t border-[var(--mtech-border)]">
          <SkeletonRows />
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className={shell} style={{ boxShadow: 'var(--mtech-shadow-card)' }}>
        <EmptyState onCreateClick={onCreateClick} />
      </div>
    );
  }

  return (
    <div className={shell} style={{ boxShadow: 'var(--mtech-shadow-card)' }}>
      <ListHeader />
      <ul className="border-t border-[var(--mtech-border)] divide-y divide-[var(--mtech-border)]">
        {projects.map((p) => {
          const clickable = !!onProjectClick;
          return (
            <li key={p.id}>
              <div
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onProjectClick(p.id) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onProjectClick(p.id);
                        }
                      }
                    : undefined
                }
                className={`${COL} px-3 py-2.5 transition-colors ${
                  clickable
                    ? 'cursor-pointer hover:bg-[var(--mtech-surface-elev)] focus-visible:outline-none focus-visible:bg-[var(--mtech-surface-elev)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]'
                    : ''
                }`}
              >
                <KeyBadge prefix={p.key_prefix} />
                <span className="truncate text-[13px] font-medium text-[var(--mtech-text)]">
                  {p.name}
                </span>
                <Lead name={p.lead_name} />
                <div className="justify-self-end">
                  <TypeBadge type={p.type} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
