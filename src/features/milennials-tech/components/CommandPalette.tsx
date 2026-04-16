import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { LayoutList, Kanban, CalendarDays, Plus, X } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        className="relative w-full max-w-lg rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border-strong)] bg-[var(--mtech-surface)] shadow-2xl overflow-hidden"
      >
        <Command className="flex flex-col" label="Command palette">
          <div className="flex items-center border-b border-[var(--mtech-border)] px-4">
            <Command.Input
              className="flex-1 h-12 bg-transparent text-sm text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] outline-none"
              placeholder="Buscar comando..."
              autoFocus
            />
            <button
              onClick={() => setOpen(false)}
              className="ml-2 p-1 rounded text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-[var(--mtech-text-muted)]">
              Nenhum resultado.
            </Command.Empty>
            <Command.Group heading="Navegação" className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)] px-2 py-1.5">
              <Command.Item
                onSelect={() => run(() => navigate('/milennials-tech/backlog'))}
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--mtech-radius-sm)] text-sm text-[var(--mtech-text)] cursor-pointer data-[selected=true]:bg-[var(--mtech-surface-elev)]"
              >
                <LayoutList className="h-4 w-4 text-[var(--mtech-text-muted)]" />
                Ir para Backlog
                <kbd className="ml-auto text-[10px] text-[var(--mtech-text-subtle)]">G B</kbd>
              </Command.Item>
              <Command.Item
                onSelect={() => run(() => navigate('/milennials-tech/kanban'))}
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--mtech-radius-sm)] text-sm text-[var(--mtech-text)] cursor-pointer data-[selected=true]:bg-[var(--mtech-surface-elev)]"
              >
                <Kanban className="h-4 w-4 text-[var(--mtech-text-muted)]" />
                Ir para Kanban
                <kbd className="ml-auto text-[10px] text-[var(--mtech-text-subtle)]">G K</kbd>
              </Command.Item>
              <Command.Item
                onSelect={() => run(() => navigate('/milennials-tech/sprints'))}
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--mtech-radius-sm)] text-sm text-[var(--mtech-text)] cursor-pointer data-[selected=true]:bg-[var(--mtech-surface-elev)]"
              >
                <CalendarDays className="h-4 w-4 text-[var(--mtech-text-muted)]" />
                Ir para Sprints
                <kbd className="ml-auto text-[10px] text-[var(--mtech-text-subtle)]">G S</kbd>
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Ações" className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)] px-2 py-1.5 mt-1">
              <Command.Item
                onSelect={() => run(() => {
                  document.dispatchEvent(new CustomEvent('mtech:create-task'));
                })}
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--mtech-radius-sm)] text-sm text-[var(--mtech-text)] cursor-pointer data-[selected=true]:bg-[var(--mtech-surface-elev)]"
              >
                <Plus className="h-4 w-4 text-[var(--mtech-text-muted)]" />
                Nova Task
                <kbd className="ml-auto text-[10px] text-[var(--mtech-text-subtle)]">C</kbd>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
