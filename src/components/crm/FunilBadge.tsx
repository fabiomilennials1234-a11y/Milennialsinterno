// src/components/crm/FunilBadge.tsx
//
// ADR 0010 — badge READ-ONLY do Funil A/B. Fonte única de leitura visual do preset
// de pipeline que o cliente segue. Reusado no modal de gerar tarefa (header), no
// olhinho do cliente (ClientViewModal) e no onboarding do ADS (criar_estrategia).
//
// Princípio de design (alinhado ao restraint do CRM): cor é INFORMAÇÃO. O funil é
// uma distinção categórica significativa (A vs B), então merece cor — dois tons
// sóbrios e distintos (violet/sky), nunca decorativos. Dark-first.
import { cn } from '@/lib/utils';
import { etapasDoFunil, FUNIL_LABEL, isFunil, type Funil } from '@/lib/crm/funil';

type FunilInput = string | null | undefined;

const FUNIL_STYLES: Record<Funil, { chip: string; dot: string }> = {
  A: {
    chip: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
    dot: 'bg-violet-400',
  },
  B: {
    chip: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    dot: 'bg-sky-400',
  },
};

const SIZE = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
} as const;

/** Pílula compacta do funil. Em ausência de funil definido, devolve null (não polui). */
export function FunilBadge({
  funil,
  size = 'md',
  className,
}: {
  funil: FunilInput;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  if (!isFunil(funil)) return null;
  const s = FUNIL_STYLES[funil];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium leading-none whitespace-nowrap',
        SIZE[size],
        s.chip,
        className,
      )}
    >
      <span className={cn('rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', s.dot)} />
      {FUNIL_LABEL[funil]}
    </span>
  );
}

/**
 * Vista READ-ONLY completa: badge + sequência de etapas do preset. Para superfícies
 * que querem mostrar a jornada inteira (ADS / olhinho do cliente). Estado vazio
 * explícito quando o cliente ainda não tem funil (geração não aconteceu).
 */
export function FunilReadonlyView({
  funil,
  className,
  emptyHint = 'Funil ainda não definido — será atribuído na geração da tarefa do CRM.',
}: {
  funil: FunilInput;
  className?: string;
  emptyHint?: string;
}) {
  const etapas = etapasDoFunil(funil);

  if (!isFunil(funil)) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-2.5',
          className,
        )}
      >
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-center gap-2">
        <FunilBadge funil={funil} size="md" />
        <span className="text-[11px] text-muted-foreground">
          {etapas.length} etapas · pipeline de qualificação
        </span>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {etapas.map((etapa, idx) => (
          <li
            key={`${etapa}-${idx}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground"
          >
            <span className="text-[9px] font-mono text-muted-foreground/50 tabular-nums">
              {String(idx + 1).padStart(2, '0')}
            </span>
            {etapa}
          </li>
        ))}
      </ol>
    </div>
  );
}
