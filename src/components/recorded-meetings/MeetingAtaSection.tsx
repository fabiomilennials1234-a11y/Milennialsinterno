import type { Json } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  RotateCcw,
  ScrollText,
} from 'lucide-react';

export interface AtaProximoPasso {
  acao: string;
  responsavel: string | null;
}

export interface AtaTopico {
  titulo: string;
  inicio_seg: number;
  pontos: string[];
}

export interface AtaStructure {
  resumo_executivo: string;
  decisoes: string[];
  proximos_passos: AtaProximoPasso[];
  topicos: AtaTopico[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function parseAtaJson(raw: Json | null): AtaStructure | null {
  if (!isRecord(raw)) return null;

  const resumo = typeof raw.resumo_executivo === 'string' ? raw.resumo_executivo : '';

  const proximosPassos: AtaProximoPasso[] = Array.isArray(raw.proximos_passos)
    ? raw.proximos_passos
        .filter(isRecord)
        .filter((p) => typeof p.acao === 'string' && p.acao.trim().length > 0)
        .map((p) => ({
          acao: p.acao as string,
          responsavel: typeof p.responsavel === 'string' && p.responsavel.trim().length > 0
            ? (p.responsavel as string)
            : null,
        }))
    : [];

  const topicos: AtaTopico[] = Array.isArray(raw.topicos)
    ? raw.topicos
        .filter(isRecord)
        .filter((t) => typeof t.titulo === 'string' && t.titulo.trim().length > 0)
        .map((t) => ({
          titulo: t.titulo as string,
          inicio_seg: typeof t.inicio_seg === 'number' && Number.isFinite(t.inicio_seg) ? t.inicio_seg : 0,
          pontos: asStringArray(t.pontos),
        }))
    : [];

  const parsed: AtaStructure = {
    resumo_executivo: resumo,
    decisoes: asStringArray(raw.decisoes),
    proximos_passos: proximosPassos,
    topicos,
  };

  const hasContent =
    parsed.resumo_executivo.length > 0 ||
    parsed.decisoes.length > 0 ||
    parsed.proximos_passos.length > 0 ||
    parsed.topicos.length > 0;

  return hasContent ? parsed : null;
}

const STATUS_LABELS: Record<string, string> = {
  none: 'Não iniciado',
  pending: 'Pendente',
  processing: 'Processando',
  completed: 'Concluída',
  failed: 'Falhou',
};

const STATUS_STYLES: Record<string, string> = {
  none: 'border-border text-muted-foreground',
  pending: 'border-amber-500/30 text-amber-600',
  processing: 'border-amber-500/30 text-amber-600',
  completed: 'border-green-500/30 text-green-600',
  failed: 'border-red-500/30 text-red-600',
};

function statusLabel(status: string | null): string {
  return STATUS_LABELS[status ?? 'none'] ?? STATUS_LABELS.none;
}

function statusStyle(status: string | null): string {
  return STATUS_STYLES[status ?? 'none'] ?? STATUS_STYLES.none;
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === 'processing' || status === 'pending') {
    return <Loader2 size={12} className="mr-1 animate-spin" />;
  }
  if (status === 'completed') return <CheckCircle2 size={12} className="mr-1" />;
  if (status === 'failed') return <AlertCircle size={12} className="mr-1" />;
  return <Clock size={12} className="mr-1" />;
}

function formatTimestamp(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export interface MeetingAtaSectionProps {
  ataJson: Json | null;
  transcriptStatus: string | null;
  ataStatus: string | null;
  onSeek: (seconds: number) => void;
  onRetryTranscript: () => void;
  onRetryAta: () => void;
}

interface StatusRowProps {
  label: string;
  status: string | null;
  testId: string;
  retryTestId: string;
  onRetry: () => void;
}

function StatusRow({ label, status, testId, retryTestId, onRetry }: StatusRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        data-testid={testId}
        className={`text-xs ${statusStyle(status)}`}
      >
        <StatusIcon status={status} />
        {label}: {statusLabel(status)}
      </Badge>
      {status === 'failed' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={retryTestId}
          onClick={onRetry}
          className="h-6 text-xs gap-1 border-red-500/30 text-red-600 hover:bg-red-500/10"
        >
          <RotateCcw size={11} />
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

export default function MeetingAtaSection({
  ataJson,
  transcriptStatus,
  ataStatus,
  onSeek,
  onRetryTranscript,
  onRetryAta,
}: MeetingAtaSectionProps) {
  const ata = parseAtaJson(ataJson);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusRow
          label="Transcrição"
          status={transcriptStatus}
          testId="transcript-status"
          retryTestId="retry-transcript"
          onRetry={onRetryTranscript}
        />
        <StatusRow
          label="Ata"
          status={ataStatus}
          testId="ata-status"
          retryTestId="retry-ata"
          onRetry={onRetryAta}
        />
      </div>

      {ata && (
        <div className="space-y-4">
          {ata.resumo_executivo && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Resumo Executivo</p>
              <p className="text-sm whitespace-pre-wrap bg-card p-3 rounded-lg border border-border">
                {ata.resumo_executivo}
              </p>
            </section>
          )}

          {ata.decisoes.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                Decisões
              </p>
              <ul className="space-y-1.5 bg-card p-3 rounded-lg border border-border">
                {ata.decisoes.map((d, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ata.proximos_passos.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <ListChecks size={12} />
                Próximos Passos
              </p>
              <ul className="space-y-1.5 bg-card p-3 rounded-lg border border-border">
                {ata.proximos_passos.map((p, i) => (
                  <li key={i} className="text-sm flex items-start gap-2 flex-wrap">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{p.acao}</span>
                    {p.responsavel ? (
                      <Badge variant="secondary" className="text-xs" data-testid="proximo-passo-responsavel">
                        {p.responsavel}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ata.topicos.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <ScrollText size={12} />
                Tópicos
              </p>
              <div className="space-y-3">
                {ata.topicos.map((t, i) => (
                  <div key={i} className="bg-card p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <button
                        type="button"
                        onClick={() => onSeek(t.inicio_seg)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-mono font-medium hover:bg-primary/20 transition-colors shrink-0"
                      >
                        <Clock size={11} />
                        {formatTimestamp(t.inicio_seg)}
                      </button>
                      <h4 className="text-sm font-semibold text-foreground">{t.titulo}</h4>
                    </div>
                    {t.pontos.length > 0 && (
                      <ul className="space-y-1 pl-1">
                        {t.pontos.map((ponto, j) => (
                          <li key={j} className="text-sm text-muted-foreground flex gap-2">
                            <span className="mt-0.5 shrink-0">–</span>
                            <span>{ponto}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
