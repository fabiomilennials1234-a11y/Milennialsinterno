import { NavLink, Outlet } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { cn } from '@/lib/utils';
import { useTechRealtime } from '../hooks/useTechRealtime';
import { CommandPalette } from '../components/CommandPalette';
import { StatusLine } from '../components/StatusLine';

const TABS = [
  { to: 'backlog', label: 'Backlog' },
  { to: 'kanban', label: 'Kanban' },
  { to: 'sprints', label: 'Sprints' },
];

export function MilennialsTechPage() {
  useTechRealtime();
  return (
    <MainLayout>
      <div className="mtech-scope min-h-screen">
        <CommandPalette />
        <header className="flex items-end justify-between px-8 pt-10 pb-6">
          <div>
            <h1 className="text-[32px] font-medium tracking-tight">Milennials Tech</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--mtech-text-muted)' }}>
              Engenharia, planejada.
            </p>
          </div>
          <nav className="flex gap-1">
            {TABS.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 text-sm rounded-md transition-colors',
                    isActive
                      ? 'text-white bg-[var(--mtech-surface)] border border-[var(--mtech-border)]'
                      : 'text-[var(--mtech-text-muted)] hover:text-white',
                  )
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="px-8 pb-24">
          <Outlet />
        </main>
        <StatusLine />
      </div>
    </MainLayout>
  );
}
