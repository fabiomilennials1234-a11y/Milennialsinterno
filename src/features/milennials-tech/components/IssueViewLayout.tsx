import { type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// IssueViewLayout — the two-panel issue view (Jira issue detail).
//
//   ┌──────────────────────────────┬──────────────────┐
//   │ header (key · title · type)  │                  │
//   ├──────────────────────────────┤  sidebar         │
//   │                              │  (metadata        │
//   │ main                         │   fields:         │
//   │ (description, activity,      │   status,         │
//   │  comments — readable column) │   assignee,       │
//   │                              │   points, epic…)  │
//   └──────────────────────────────┴──────────────────┘
//
// Main holds the narrative at a readable measure; the sidebar holds the
// structured metadata as label/value rows. Stacks to one column under md.
// Pure presentational shell — slots take any content. Engineer pairs against
// IssueViewLayoutProps and composes fields with IssueViewSidebarField/Section.
// ---------------------------------------------------------------------------

export interface IssueViewLayoutProps {
  /** Top bar: breadcrumb / key / title / type. Spans the main column. */
  header?: ReactNode;
  /** Primary narrative column: description, activity, comments. */
  main: ReactNode;
  /** Right metadata rail. */
  sidebar: ReactNode;
  className?: string;
}

export function IssueViewLayout({ header, main, sidebar, className = '' }: IssueViewLayoutProps) {
  return (
    <div
      className={`mtech-scope flex flex-col overflow-hidden rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] md:flex-row ${className}`}
      style={{ boxShadow: 'var(--mtech-shadow-card)' }}
    >
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {header && (
          <div className="border-b border-[var(--mtech-border)] px-5 py-4 md:px-7 md:py-5">
            {header}
          </div>
        )}
        <div className="min-w-0 flex-1 px-5 py-5 md:px-7 md:py-6">
          <div className="mx-auto w-full max-w-[680px]">{main}</div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex-shrink-0 border-t border-[var(--mtech-border)] bg-[var(--mtech-bg)]/40 px-5 py-5 md:w-[300px] md:border-l md:border-t-0 md:px-5 md:py-6">
        <div className="flex flex-col gap-5">{sidebar}</div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IssueViewSidebarSection — a titled group of metadata fields.
// ---------------------------------------------------------------------------

export interface IssueViewSidebarSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function IssueViewSidebarSection({
  title,
  children,
  className = '',
}: IssueViewSidebarSectionProps) {
  return (
    <section className={className}>
      {title && (
        <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)]">
          {title}
        </h3>
      )}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// IssueViewSidebarField — one label/value metadata row.
//
// Label sits on a fixed measure so values align into a clean column. Value is
// any node — a badge, an avatar+name, a points pill, an epic chip.
// ---------------------------------------------------------------------------

export interface IssueViewSidebarFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function IssueViewSidebarField({
  label,
  children,
  className = '',
}: IssueViewSidebarFieldProps) {
  return (
    <div className={`grid grid-cols-[96px_1fr] items-center gap-3 ${className}`}>
      <span className="text-[11px] font-medium text-[var(--mtech-text-subtle)]">{label}</span>
      <div className="min-w-0 text-[12px] text-[var(--mtech-text)]">{children}</div>
    </div>
  );
}
