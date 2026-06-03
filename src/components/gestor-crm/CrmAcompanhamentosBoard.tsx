import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { CalendarClock, CheckCircle2, ListChecks, Hourglass, X, Plus, Check } from 'lucide-react';
import {
  useTorqueAcompanhamentos,
  useMoverAcompanhamento,
  useSetChecklistAcompanhamento,
  type AcompRow,
} from '@/hooks/useTorqueAcompanhamentos';
import {
  ACOMP_COLUNAS,
  ACOMP_COLUNA_LABEL,
  isAcompColuna,
  type AcompColuna,
} from '@/lib/torqueCrm/acompanhamento';
import {
  toggle,
  add,
  remove,
  rename,
  progress,
  type ChecklistItem,
} from '@/lib/torqueCrm/checklist';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// =============================================================================
// Board de Acompanhamentos (pós-implantação) — aba ACOMPANHAMENTOS. ADR 0006 §2.
//
// 4 colunas: Fazer follow-up | Follow-up feito | Tasks em aberto | Aguardando
// resposta. Cada card (1 acompanhamento ATIVO por cliente) vive em exatamente
// uma coluna; DRAG LIVRE — o gestor move manualmente, em qualquer ordem (sem
// gate sequencial). A escrita vai pela RPC torque_acomp_mover (regra de coluna
// no reducer puro acompanhamento.ts + servidor). Mundos separados do board de
// implantação — esta aba nunca lê crm_configuracoes.
//
// Slice 5 (#95): drag + leitura. A edição do checklist de "Tasks em aberto" e o
// reset de segunda (pg_cron) chegam na Slice #96.
// =============================================================================

const COLUMN_ICON: Record<AcompColuna, typeof CalendarClock> = {
  fazer_follow_up: CalendarClock,
  follow_up_feito: CheckCircle2,
  tasks_em_aberto: ListChecks,
  aguardando_resposta: Hourglass,
};

function clientNameOf(row: AcompRow): string {
  return (
    row.clients?.client_label ||
    row.clients?.razao_social ||
    row.clients?.name ||
    'Cliente'
  );
}

export default function CrmAcompanhamentosBoard() {
  const { data: rows = [], isLoading } = useTorqueAcompanhamentos();
  const mover = useMoverAcompanhamento();

  const byColumn = useMemo(() => {
    const map = new Map<AcompColuna, AcompRow[]>();
    for (const c of ACOMP_COLUNAS) map.set(c, []);
    for (const row of rows) {
      const arr = map.get(row.coluna);
      if (arr) arr.push(row);
    }
    return map;
  }, [rows]);

  function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return; // no-op: mesma coluna
    const destino = destination.droppableId;
    if (!isAcompColuna(destino)) return; // blinda payload corrompido
    mover.mutate({ acompId: draggableId, coluna: destino });
  }

  if (isLoading) {
    return (
      <div className="flex gap-5 px-8 py-6">
        {ACOMP_COLUNAS.map((c) => (
          <div key={c} className="w-[300px] h-40 skeleton-static rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-5 px-8 py-6 overflow-x-auto scrollbar-apple">
        {ACOMP_COLUNAS.map((coluna) => {
          const Icon = COLUMN_ICON[coluna];
          const cards = byColumn.get(coluna) ?? [];
          return (
            <Droppable key={coluna} droppableId={coluna}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'crm-column w-[300px] flex-shrink-0 flex flex-col overflow-hidden rounded-xl transition-all duration-200',
                    snapshot.isDraggingOver && 'ring-2 ring-[var(--mtech-accent)]/40'
                  )}
                >
                  <div className="crm-column-header">
                    <Icon />
                    <h2 className="crm-column-title truncate">
                      {ACOMP_COLUNA_LABEL[coluna]}
                    </h2>
                    {cards.length > 0 && (
                      <span className="crm-column-count">{cards.length}</span>
                    )}
                  </div>

                  <div className="crm-column-body flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple min-h-[120px]">
                    {cards.length === 0 ? (
                      <div className="crm-empty">
                        <Icon />
                        <p>Nenhum acompanhamento</p>
                      </div>
                    ) : (
                      cards.map((row, index) => (
                        <Draggable key={row.id} draggableId={row.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={cn(
                                'crm-card px-3 py-2.5 text-sm cursor-grab active:cursor-grabbing',
                                snap.isDragging && 'crm-card--dragging'
                              )}
                            >
                              <span className="block truncate font-medium text-sm leading-snug text-foreground">{clientNameOf(row)}</span>
                              {/* Tasks em aberto: checklist EDITÁVEL que começa vazio
                                  (ADR §2). Marcar todas → auto-move tasks_em_aberto
                                  -> fazer_follow_up, decidido ATÔMICO na RPC. */}
                              {coluna === 'tasks_em_aberto' && (
                                <AcompTasksChecklist acompId={row.id} checklist={row.checklist ?? []} />
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

/**
 * Checklist editável de "Tasks em aberto" (Slice #96, ADR 0006 §2). Começa VAZIO
 * — o gestor define as pendências. Sem gate de ordem: qualquer item marcável a
 * qualquer momento; add/remove/rename por item. Toda mutação computa o próximo
 * array com o módulo PURO checklist.ts e persiste o array INTEIRO via
 * useSetChecklistAcompanhamento → RPC torque_acomp_checklist_set, que decide o
 * auto-move ATÔMICO (marcar todas → card sai pra "Fazer follow-up").
 *
 * Espelha a interação do EditableChecklist do board de implantação (#93). NÃO
 * compartilha JSX: os dois boards persistem por hooks distintos; duplicar ~40
 * linhas é mais barato que acoplar duas telas a um contrato de componente único.
 *
 * stopPropagation no clique/foco: os controles vivem dentro de um card
 * Draggable (@hello-pangea/dnd); sem isso, interagir com o checklist iniciaria
 * um drag do card.
 */
function AcompTasksChecklist({ acompId, checklist }: { acompId: string; checklist: ChecklistItem[] }) {
  const setChecklist = useSetChecklistAcompanhamento();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const persist = (next: ChecklistItem[]) => setChecklist.mutate({ acompId, checklist: next });
  const busy = setChecklist.isPending;
  const { done, total } = progress(checklist);

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) { setAdding(false); setNewLabel(''); return; }
    persist(add(checklist, { id: crypto.randomUUID(), label }));
    setNewLabel('');
    setAdding(false);
  };

  const handleRename = (id: string) => {
    const label = editLabel.trim();
    if (label) persist(rename(checklist, id, label));
    setEditingId(null);
    setEditLabel('');
  };

  return (
    <div
      className="mt-2 pt-2 border-t border-[var(--mtech-border)]/40 space-y-1"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {total > 0 && (
        <span className={cn('crm-progress', done === total && 'crm-progress--done')}>
          <ListChecks size={10} />
          {done}/{total}
        </span>
      )}

      {checklist.map((item) => (
        <div key={item.id} className="group flex items-start gap-1.5 text-[11px]">
          <button
            type="button"
            aria-label={item.done ? `Desmarcar ${item.label}` : `Marcar ${item.label}`}
            aria-pressed={item.done}
            disabled={busy}
            onClick={() => persist(toggle(checklist, item.id))}
            className={cn('crm-check mt-0.5 shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-accent)]/50 rounded', item.done && 'crm-check--done')}
          >
            <CheckCircle2 size={12} />
          </button>

          {editingId === item.id ? (
            <Input
              autoFocus
              value={editLabel}
              disabled={busy}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={() => handleRename(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(item.id);
                if (e.key === 'Escape') { setEditingId(null); setEditLabel(''); }
              }}
              className="h-5 px-1 py-0 text-[11px]"
            />
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => { setEditingId(item.id); setEditLabel(item.label); }}
              className={cn(
                'flex-1 text-left min-w-0 break-words disabled:opacity-50',
                item.done ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {item.label}
            </button>
          )}

          <button
            type="button"
            aria-label={`Remover ${item.label}`}
            disabled={busy}
            onClick={() => persist(remove(checklist, item.id))}
            className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground/50 hover:text-danger disabled:opacity-50"
          >
            <X size={11} />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={newLabel}
            disabled={busy}
            placeholder="Nova task…"
            onChange={(e) => setNewLabel(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewLabel(''); }
            }}
            className="h-5 px-1 py-0 text-[11px]"
          />
          <button
            type="button"
            aria-label="Confirmar nova task"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={handleAdd}
            className="shrink-0 text-success"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[10px] text-[var(--mtech-text-muted)] hover:text-foreground disabled:opacity-50 pt-0.5"
        >
          <Plus size={10} /> Adicionar task
        </button>
      )}
    </div>
  );
}
