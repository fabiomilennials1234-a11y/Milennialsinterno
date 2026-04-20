import { useEffect, useState } from 'react';
import { Flag, Clock } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { KanbanCard, KanbanColumn } from '@/hooks/useKanban';

interface KanbanQuickSearchProps {
  cards: KanbanCard[];
  columns: KanbanColumn[];
  onSelect: (card: KanbanCard) => void;
}

export default function KanbanQuickSearch({ cards, columns, onSelect }: KanbanQuickSearchProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      } else if (!isEditable && !open && e.key === '/') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const columnTitleById = columns.reduce<Record<string, string>>((acc, c) => {
    acc[c.id] = c.title.replace(/^BY\s+/i, '');
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar por título, descrição ou tag…" />
      <CommandList>
        <CommandEmpty>Nenhum card encontrado.</CommandEmpty>
        <CommandGroup heading={`${cards.length} card${cards.length === 1 ? '' : 's'} neste board`}>
          {cards.slice(0, 50).map(card => (
            <CommandItem
              key={card.id}
              value={`${card.title} ${card.description ?? ''} ${(card.tags ?? []).join(' ')} ${columnTitleById[card.column_id] ?? ''}`}
              onSelect={() => {
                onSelect(card);
                setOpen(false);
              }}
              className="flex items-center gap-3"
            >
              {card.priority === 'urgent' ? (
                <Flag size={14} strokeWidth={2.5} fill="currentColor" className="text-danger" />
              ) : card.priority === 'high' ? (
                <Flag size={14} strokeWidth={2.5} fill="currentColor" className="text-warning" />
              ) : (
                <span className="w-3.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{card.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {columnTitleById[card.column_id] ?? 'Sem coluna'}
                  {card.due_date && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <Clock size={10} />
                      {new Date(card.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
