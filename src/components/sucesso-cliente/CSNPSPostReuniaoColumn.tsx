import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Minus, Users } from 'lucide-react';
import CSColumnScroll from './CSColumnScroll';
import {
  useAllClientNps,
  getNpsClassification,
  getNpsColor,
  getNpsBgColor,
  getNpsLabel,
  type ClientNpsWithName,
  type NpsClassification,
} from '@/hooks/useClientNps';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Group NPS by classification, deduplicate by client (latest only) ──

function groupAndDedup(responses: ClientNpsWithName[]) {
  // Keep only latest per client
  const latestByClient = new Map<string, ClientNpsWithName>();
  for (const r of responses) {
    if (!latestByClient.has(r.client_id)) {
      latestByClient.set(r.client_id, r);
    }
  }

  const grouped: Record<NpsClassification, ClientNpsWithName[]> = {
    detrator: [],
    neutro: [],
    promotor: [],
  };

  for (const r of latestByClient.values()) {
    const cls = getNpsClassification(r.nps_score);
    grouped[cls].push(r);
  }

  // Detratores first (sorted by score asc — worst first)
  grouped.detrator.sort((a, b) => a.nps_score - b.nps_score);
  grouped.neutro.sort((a, b) => a.nps_score - b.nps_score);
  grouped.promotor.sort((a, b) => b.nps_score - a.nps_score);

  return grouped;
}

function NpsCard({ nps }: { nps: ClientNpsWithName }) {
  const classification = getNpsClassification(nps.nps_score);
  const isDetrator = classification === 'detrator';

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isDetrator
          ? 'border-destructive/40 bg-destructive/5 shadow-sm shadow-destructive/10'
          : classification === 'neutro'
            ? 'border-amber-400/30 bg-amber-400/5'
            : 'border-emerald-400/30 bg-emerald-400/5'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {nps.client_name}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${getNpsColor(classification)} border-current/30`}
            >
              {getNpsLabel(classification)}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {nps.reference_month}
            </span>
          </div>
          {nps.score_reason && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
              {nps.score_reason}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {nps.created_at
              ? format(new Date(nps.created_at), "dd/MM/yyyy", { locale: ptBR })
              : ''}
          </p>
        </div>
        <div className={`text-2xl font-black tabular-nums shrink-0 ${getNpsColor(classification)}`}>
          {nps.nps_score}
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ classification, count }: { classification: NpsClassification; count: number }) {
  const config = {
    detrator: { icon: ThumbsDown, label: 'Detratores', color: 'text-red-400' },
    neutro: { icon: Minus, label: 'Neutros', color: 'text-amber-400' },
    promotor: { icon: ThumbsUp, label: 'Promotores', color: 'text-emerald-400' },
  }[classification];

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <Icon size={14} className={config.color} />
      <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
        {count}
      </Badge>
    </div>
  );
}

export default function CSNPSPostReuniaoColumn() {
  const { data: allNps = [], isLoading } = useAllClientNps();

  const grouped = useMemo(() => groupAndDedup(allNps), [allNps]);

  const total = grouped.detrator.length + grouped.neutro.length + grouped.promotor.length;

  return (
    <div className="w-[340px] h-full flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
      {/* Header */}
      <div className="section-header section-header-teal">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <ThumbsUp size={18} className="text-foreground" />
            <h2 className="font-semibold">NPS Pos Reuniao</h2>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-foreground border-0">
            {total}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CSColumnScroll contentClassName="p-4 space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">Carregando...</p>
          </div>
        ) : total === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ThumbsUp className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">Nenhum NPS registrado</p>
          </div>
        ) : (
          <>
            {/* Detratores first (priority) */}
            {grouped.detrator.length > 0 && (
              <>
                <GroupHeader classification="detrator" count={grouped.detrator.length} />
                {grouped.detrator.map((nps) => (
                  <NpsCard key={nps.id} nps={nps} />
                ))}
              </>
            )}

            {/* Neutros */}
            {grouped.neutro.length > 0 && (
              <>
                <GroupHeader classification="neutro" count={grouped.neutro.length} />
                {grouped.neutro.map((nps) => (
                  <NpsCard key={nps.id} nps={nps} />
                ))}
              </>
            )}

            {/* Promotores */}
            {grouped.promotor.length > 0 && (
              <>
                <GroupHeader classification="promotor" count={grouped.promotor.length} />
                {grouped.promotor.map((nps) => (
                  <NpsCard key={nps.id} nps={nps} />
                ))}
              </>
            )}
          </>
        )}
      </CSColumnScroll>
    </div>
  );
}
