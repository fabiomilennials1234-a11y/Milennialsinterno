import { useMemo, useRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ListTodo, Wrench, Settings, Bot, CalendarClock, CheckCircle2,
  ListChecks, ChevronLeft, ChevronRight, Plus, X, Check, CalendarPlus, Clock,
} from 'lucide-react';
import {
  useCrmConfiguracoes,
  useComecarCard,
  useSetChecklist,
  useAgendarApresentacao,
  useMarcarPronto,
  useCrmSla,
  CRM_PRODUTO_LABEL,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import {
  toggle, add, remove, rename, progress, type ChecklistItem,
} from '@/lib/torqueCrm/checklist';
import { podeConcluir, toSpInputValue, fromSpInputValue } from '@/lib/torqueCrm/dateGate';
import { boardEntryLabel } from '@/lib/torqueCrm/boardEntry';
import { resolveSlaDays, type SlaMap } from '@/lib/torqueCrm/crmSla';
import { computeOverdue } from '@/lib/torqueCrm/overdue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// =============================================================
// Board Torque CRM — aba Kanban (ADR 0006). Slice 1 (#91): READ-ONLY.
//
// 6 colunas fixas: A FAZER → TORQUE → AUTOMATION → COPILOT → APRESENTAÇÃO →
// PRONTOS. Cada card (1 por cliente, no tier mais alto) cai na coluna do seu
// `board_status`; as três colunas de tier desdobram por `produto`. Mostra o
// checklist achatado e o badge de progresso (done/total).
//
// As interações (Começar / marcar item / agendar apresentação / Pronto /
// reagendar) chegam nas slices #92–97 — aqui é só leitura.
// =============================================================

type BoardColumnId = 'a_fazer' | 'torque' | 'automation' | 'copilot' | 'apresentacao' | 'pronto';

interface BoardColumn {
  id: BoardColumnId;
  title: string;
  icon: typeof Wrench;
  /** semantic accent: success só em PRONTOS (estado terminal). */
  semantic: 'neutral' | 'success';
  /** quando a coluna é um tier, o produto que ela representa. */
  tier?: CrmProduto;
}

const BOARD_COLUMNS: BoardColumn[] = [
  { id: 'a_fazer', title: 'A Fazer', icon: ListTodo, semantic: 'neutral' },
  { id: 'torque', title: 'Torque', icon: Wrench, semantic: 'neutral', tier: 'torque' },
  { id: 'automation', title: 'Automation', icon: Settings, semantic: 'neutral', tier: 'automation' },
  { id: 'copilot', title: 'Copilot', icon: Bot, semantic: 'neutral', tier: 'copilot' },
  { id: 'apresentacao', title: 'Apresentação', icon: CalendarClock, semantic: 'neutral' },
  { id: 'pronto', title: 'Prontos', icon: CheckCircle2, semantic: 'success' },
];

interface CrmConfigRow {
  id: string;
  client_id: string;
  produto: CrmProduto;
  board_status: BoardColumnId;
  checklist: ChecklistItem[] | null;
  apresentacao_at: string | null;
  /** quando o card entrou no board (timestamptz). Origem do "No board desde". */
  created_at: string | null;
  /** quando o card entrou na coluna atual (#129). Relógio do SLA. */
  stage_entered_at: string | null;
  clients?: { name?: string; razao_social?: string; client_label?: string | null } | null;
}

/** Conta itens done/total (tolerante a null/shape legado; delega ao módulo puro). */
function checklistProgress(checklist: ChecklistItem[] | null): { done: number; total: number } {
  return progress(Array.isArray(checklist) ? checklist : []);
}

/**
 * Decide a coluna de um card. A FAZER / APRESENTAÇÃO / PRONTOS são pelo
 * board_status; as colunas de tier batem board_status='tier' + produto.
 */
function columnOf(cfg: CrmConfigRow): BoardColumnId {
  if (cfg.board_status === 'tier') return cfg.produto;
  return cfg.board_status;
}

export default function CrmBoardKanban() {
  const { data: configsRaw = [], isLoading } = useCrmConfiguracoes();
  const configs = configsRaw as unknown as CrmConfigRow[];
  // SLA por coluna (#130): atraso é DERIVADO em render, nunca persistido.
  const { data: slaMap = {} } = useCrmSla();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    checkScroll();
    return () => el.removeEventListener('scroll', checkScroll);
  }, [configs.length]);

  const byColumn = useMemo(() => {
    const map = new Map<BoardColumnId, CrmConfigRow[]>();
    for (const col of BOARD_COLUMNS) map.set(col.id, []);
    for (const cfg of configs) {
      const arr = map.get(columnOf(cfg));
      if (arr) arr.push(cfg);
    }
    return map;
  }, [configs]);

  if (isLoading) {
    return (
      <div className="flex gap-5 px-8 py-6">
        {BOARD_COLUMNS.map((c) => (
          <div key={c.id} className="w-[320px] h-40 skeleton-static rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      {canLeft && (
        <button
          aria-label="Rolar para a esquerda"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mtech-accent)]/50"
          style={{ background: 'var(--mtech-surface-elev)', border: '1px solid var(--mtech-border)', boxShadow: 'var(--mtech-shadow-card)' }}
          onClick={() => scrollRef.current?.scrollBy({ left: -380, behavior: 'smooth' })}
        >
          <ChevronLeft size={18} style={{ color: 'var(--mtech-text-muted)' }} />
        </button>
      )}
      {canRight && (
        <button
          aria-label="Rolar para a direita"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mtech-accent)]/50"
          style={{ background: 'var(--mtech-surface-elev)', border: '1px solid var(--mtech-border)', boxShadow: 'var(--mtech-shadow-card)' }}
          onClick={() => scrollRef.current?.scrollBy({ left: 380, behavior: 'smooth' })}
        >
          <ChevronRight size={18} style={{ color: 'var(--mtech-text-muted)' }} />
        </button>
      )}

      <div ref={scrollRef} className="overflow-x-auto px-8 py-6 scrollbar-apple">
        <div className="flex gap-5 pb-4" style={{ minWidth: 'max-content' }}>
          {BOARD_COLUMNS.map((column) => {
            const Icon = column.icon;
            const cards = byColumn.get(column.id) ?? [];
            return (
              <div
                key={column.id}
                className={cn(
                  'crm-column w-[320px] flex-shrink-0 flex flex-col overflow-hidden',
                  column.semantic === 'success' && 'crm-column--success',
                )}
              >
                <div className="crm-column-header">
                  <Icon />
                  <h2 className="crm-column-title truncate">{column.title}</h2>
                  {cards.length > 0 && (
                    <span className="crm-column-count">{cards.length}</span>
                  )}
                </div>
                <div className="crm-column-body flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple">
                  {cards.length === 0 ? (
                    <div className="crm-empty">
                      <Icon />
                      <p>Nenhum card</p>
                    </div>
                  ) : (
                    cards.map((cfg) => <BoardCard key={cfg.id} cfg={cfg} columnId={column.id} slaMap={slaMap} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BoardCard({ cfg, columnId, slaMap }: { cfg: CrmConfigRow; columnId: BoardColumnId; slaMap: SlaMap }) {
  const clientName = cfg.clients?.razao_social || cfg.clients?.name || 'Cliente';
  const { done, total } = checklistProgress(cfg.checklist);
  const complete = total > 0 && done === total;
  const isTierColumn = columnId === 'torque' || columnId === 'automation' || columnId === 'copilot';
  const checklist = Array.isArray(cfg.checklist) ? cfg.checklist : [];
  const comecar = useComecarCard();
  // "No board desde DD/MM" (#128) — em TODA coluna; fuso SP no módulo puro.
  const entryLabel = boardEntryLabel(cfg.created_at);

  // Atraso por SLA da coluna (#130). DERIVADO em render, nunca persistido.
  // Prontos não tem SLA (resolveSlaDays -> null -> computeOverdue nunca atrasa).
  const slaDays = resolveSlaDays(slaMap, cfg.board_status, cfg.produto);
  const overdue = computeOverdue({
    stageEnteredAt: cfg.stage_entered_at,
    slaDays,
    now: new Date(),
  });

  return (
    <Card
      className={cn(
        'border-subtle',
        overdue.estado === 'atrasado' && 'border-l-4 border-l-danger bg-danger/5',
        overdue.estado === 'iminente' && 'border-l-4 border-l-warning bg-warning/5',
      )}
    >
      <CardContent className="p-3 space-y-2.5">
        {/* SLA — estado de urgência derivado (módulo puro, fuso SP). Único eixo. */}
        {overdue.estado === 'atrasado' && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-danger">
            ⚠️ Atrasado — {overdue.diasAlemPrazo}d além do prazo
          </div>
        )}
        {overdue.estado === 'iminente' && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-warning">
            <Clock size={10} />
            {overdue.diasRestantes === 0 ? 'Vence hoje' : 'Falta 1d'}
          </div>
        )}
        {overdue.estado === 'ok' && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <Clock size={10} />
            Faltam {overdue.diasRestantes}d para o prazo
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-snug">{clientName}</h4>
            {total > 0 && (
              <span className={cn('crm-progress', complete && 'crm-progress--done')}>
                <ListChecks size={10} />
                {done}/{total}
              </span>
            )}
          </div>
          <Badge className="bg-muted text-muted-foreground border-border border text-[10px] shrink-0">
            {CRM_PRODUTO_LABEL[cfg.produto]}
          </Badge>
        </div>

        {/* "No board desde DD/MM" (#128) — toda coluna. Fuso SP no módulo puro. */}
        {entryLabel && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <CalendarClock size={10} />
            {entryLabel}
          </span>
        )}

        {/* Apresentação (Slice #94): agendar/reagendar data+hora e — a partir de
            00h do dia agendado (fuso SP) — concluir (PRONTO) ou reagendar. */}
        {columnId === 'apresentacao' && (
          <ApresentacaoCard configId={cfg.id} apresentacaoAt={cfg.apresentacao_at} />
        )}

        {/* Começar — só em A FAZER. Promove o card pra coluna do seu tier
            (board_status a_fazer -> tier) via RPC torque_board_comecar. */}
        {columnId === 'a_fazer' && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full h-7 text-[11px] font-medium"
            disabled={comecar.isPending}
            onClick={() => comecar.mutate({ configId: cfg.id })}
          >
            {comecar.isPending ? 'Iniciando…' : 'Começar'}
          </Button>
        )}

        {/* Checklist EDITÁVEL (Slice #93) — só nas colunas de tier, onde é o foco
            de trabalho. Marcar TODOS auto-move o card pra Apresentação (decidido
            no servidor pela RPC torque_board_checklist_set). */}
        {isTierColumn && (
          <EditableChecklist configId={cfg.id} checklist={checklist} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Checklist editável de um card de tier (Slice #93, ADR 0006). Sem gate de ordem:
 * qualquer item marcável a qualquer momento. Add/remove/rename por item. Toda
 * mutação computa o próximo array com o módulo PURO checklist.ts e persiste o
 * array inteiro via useSetChecklist → RPC (que decide o auto-move atômico).
 */
function EditableChecklist({ configId, checklist }: { configId: string; checklist: ChecklistItem[] }) {
  const setChecklist = useSetChecklist();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const persist = (next: ChecklistItem[]) => setChecklist.mutate({ configId, checklist: next });
  const busy = setChecklist.isPending;

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
    <div className="pt-1 border-t border-border/30 space-y-1">
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
            placeholder="Novo item…"
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
            aria-label="Confirmar novo item"
            onMouseDown={(e) => e.preventDefault()}
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
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50 pt-0.5"
        >
          <Plus size={10} /> Adicionar item
        </button>
      )}
    </div>
  );
}

/**
 * Card de APRESENTAÇÃO (Slice #94, ADR 0006). Dois momentos:
 *
 *  1. Sempre: escolher data+hora da apresentação (datetime-local, fuso SP).
 *     Primeiro agendamento e reagendamento são a MESMA operação (grava
 *     apresentacao_at via useAgendarApresentacao → RPC torque_board_agendar).
 *
 *  2. ANTES do dia agendado: só exibe a data marcada — sem botão de conclusão.
 *     A PARTIR de 00h do dia agendado (gate dateGate.podeConcluir, fuso SP)
 *     liberam PRONTO (→ PRONTOS, via useMarcarPronto → RPC que RE-VALIDA o gate
 *     no servidor) e REAGENDAR (reabre o seletor de data). O botão é só UX; a
 *     verdade do gate é no servidor.
 */
function ApresentacaoCard({ configId, apresentacaoAt }: { configId: string; apresentacaoAt: string | null }) {
  const agendar = useAgendarApresentacao();
  const pronto = useMarcarPronto();

  // Reabre o seletor para (re)agendar. Sem data ainda → começa aberto.
  const [editing, setEditing] = useState(!apresentacaoAt);
  const [value, setValue] = useState(() => toSpInputValue(apresentacaoAt));

  const liberado = podeConcluir(apresentacaoAt);
  const busy = agendar.isPending || pronto.isPending;

  const salvar = () => {
    const iso = fromSpInputValue(value);
    if (!iso) return;
    agendar.mutate(
      { configId, apresentacaoAt: iso },
      { onSuccess: () => setEditing(false) },
    );
  };

  // Modo edição: escolher/trocar a data. Mostrado no 1º agendamento e ao reagendar.
  if (editing) {
    return (
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarPlus size={10} /> Data e hora da apresentação
        </label>
        <Input
          type="datetime-local"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 text-[11px]"
        />
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 h-7 text-[11px] font-medium"
            disabled={busy || !value}
            onClick={salvar}
          >
            {agendar.isPending ? 'Salvando…' : 'Salvar data'}
          </Button>
          {apresentacaoAt && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              disabled={busy}
              onClick={() => { setEditing(false); setValue(toSpInputValue(apresentacaoAt)); }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Modo leitura: data marcada. Botões de conclusão só a partir do dia (gate).
  return (
    <div className="space-y-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <CalendarClock size={10} />
        {apresentacaoAt
          ? new Date(apresentacaoAt).toLocaleString('pt-BR', {
              dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
            })
          : 'Sem data'}
      </span>

      {liberado ? (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="flex-1 h-7 text-[11px] font-medium bg-success/15 text-success hover:bg-success/25 border border-success/30"
            disabled={busy}
            onClick={() => pronto.mutate({ configId })}
          >
            {pronto.isPending ? 'Concluindo…' : 'Pronto'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            disabled={busy}
            onClick={() => { setEditing(true); setValue(toSpInputValue(apresentacaoAt)); }}
          >
            Reagendar
          </Button>
        </div>
      ) : (
        // Antes do dia: sem conclusão. Só permite ajustar a data agendada.
        <button
          type="button"
          disabled={busy}
          onClick={() => { setEditing(true); setValue(toSpInputValue(apresentacaoAt)); }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <CalendarPlus size={10} /> Alterar data
        </button>
      )}
    </div>
  );
}
