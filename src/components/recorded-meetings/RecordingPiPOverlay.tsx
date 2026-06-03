import { useEffect, useMemo, useRef } from 'react';
import {
  Pause,
  Play,
  Square,
  X,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { formatDuration, getAssemblyLabel } from './recordingUtils';
import type { OverlayState } from '@/hooks/useRecordingOrchestrator';
import type { AssemblyStage } from '@/hooks/useRecordingAssembly';
import type { RecordingHealth, HealthStatus } from '@/hooks/useRecordingHealth';

/**
 * RecordingPiPOverlay
 * -------------------
 * Self-contained recording overlay engineered to live inside a Document
 * Picture-in-Picture window (~340px wide, always-on-top, floating over ANY app).
 *
 * Why self-contained: a Document PiP window has its OWN `document` and does NOT
 * inherit the parent page's CSS / Tailwind / design tokens. So this component
 * ships its OWN `<style>` block (scoped under `.rpip-root`) re-declaring the
 * Milennials dark palette as local CSS vars. The same component is reused, with
 * `variant="inline"`, as the in-page fallback bar for Safari/Firefox (no PiP).
 *
 * The engineer mounts this via createRoot into either:
 *   - the PiP window's `document.body` (variant="pip"), or
 *   - the host page via portal (variant="inline").
 */

export type PiPVariant = 'pip' | 'inline';

export interface RecordingPiPOverlayProps {
  variant?: PiPVariant;
  /** Document the overlay is mounted into. PiP passes its own window.document;
   *  inline passes the host document. Used to inject the <style> once. */
  targetDocument?: Document;

  overlayState: OverlayState;
  durationSeconds: number;
  title: string;

  pendingChunkCount: number;
  isOffline: boolean;
  isApproachingLimit: boolean;
  remainingSeconds: number;

  health: RecordingHealth;

  /** processing-stage label source */
  assemblyStage: AssemblyStage;
  /** non-null only in error state */
  errorMessage: string | null;

  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
  /** error recovery */
  onRetry?: () => void;
  /** dismiss processing/done/error card */
  onDismiss?: () => void;
  /** inline → re-open as PiP window (only shown in inline variant when supported) */
  onPopOut?: () => void;
}

/* ────────────────────────────────────────────────────────────────────────────
   STYLES — injected once per target document. Scoped under `.rpip-root`.
   Palette mirrors src/index.css dark tokens (HSL), restated here because the
   PiP document can't see them. Single source of visual truth for the overlay.
   ──────────────────────────────────────────────────────────────────────────── */

const STYLE_ID = 'rpip-style';

const CSS = `
.rpip-root, .rpip-root * { box-sizing: border-box; margin: 0; padding: 0; }
.rpip-root {
  /* palette — mirrors Milennials dark tokens */
  --rpip-canvas: hsl(240 10% 4%);
  --rpip-surface: hsl(240 8% 9%);
  --rpip-elevated: hsl(240 7% 13%);
  --rpip-border: hsl(240 6% 22%);
  --rpip-border-strong: hsl(240 7% 30%);
  --rpip-fg: hsl(240 6% 96%);
  --rpip-fg-2: hsl(240 5% 68%);   /* secondary */
  --rpip-fg-3: hsl(240 5% 52%);   /* tertiary / meta — AA-safe on small text */
  --rpip-rec: hsl(0 84% 62%);     /* danger / recording */
  --rpip-rec-soft: hsl(0 84% 62% / 0.14);
  --rpip-pause: hsl(38 95% 55%);  /* warning / paused */
  --rpip-pause-soft: hsl(38 95% 55% / 0.14);
  --rpip-ok: hsl(160 70% 45%);    /* success */
  --rpip-info: hsl(214 90% 60%);  /* processing */
  --rpip-ring: hsl(48 100% 55%);  /* brand amber focus */

  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  color: var(--rpip-fg);
  width: 100%;
  height: 100%;
}

/* PiP window fills viewport edge-to-edge; inline floats as a pill.
   The PiP document html/body are painted imperatively (see useInjectedStyle),
   because a descendant selector cannot reach body from .rpip-root. */
.rpip-root[data-variant="pip"] { background: var(--rpip-canvas); }

.rpip-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--rpip-canvas);
}
.rpip-root[data-variant="inline"] .rpip-shell {
  height: auto;
  background: var(--rpip-surface);
  border: 1px solid var(--rpip-border);
  border-radius: 16px;
  box-shadow:
    0 0 0 1px hsl(0 0% 0% / 0.4),
    0 18px 50px -12px hsl(0 0% 0% / 0.7);
  overflow: hidden;
}

/* ── status accent rail: a 2px left-edge stripe carries state color at a glance ── */
.rpip-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 16px 14px;
  position: relative;
  flex: 1;
  min-height: 0;
}
.rpip-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--rail, transparent);
}
.rpip-root[data-state="recording"] { --rail: var(--rpip-rec); }
.rpip-root[data-state="paused"]    { --rail: var(--rpip-pause); }
.rpip-root[data-state="processing"]{ --rail: var(--rpip-info); }
.rpip-root[data-state="done"]      { --rail: var(--rpip-ok); }
.rpip-root[data-state="error"]     { --rail: var(--rpip-rec); }

/* ── header row: dot + state word + spacer + health + popout ── */
.rpip-head { display: flex; align-items: center; gap: 8px; }
.rpip-state-word {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--rpip-fg-2);
}
.rpip-root[data-state="recording"] .rpip-state-word { color: var(--rpip-rec); }
.rpip-root[data-state="paused"] .rpip-state-word { color: var(--rpip-pause); }
.rpip-spacer { flex: 1; }

.rpip-dot { width: 9px; height: 9px; border-radius: 999px; flex: none; }
.rpip-dot--rec { background: var(--rpip-rec); box-shadow: 0 0 0 3px hsl(0 84% 62% / 0.22); }
.rpip-dot--pause { background: var(--rpip-pause); }

/* ── timer: the hero. tabular, large, tight tracking ── */
.rpip-timer {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  font-size: 34px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--rpip-fg);
}
.rpip-root[data-state="paused"] .rpip-timer { color: var(--rpip-fg-2); }

.rpip-title {
  font-size: 12.5px;
  line-height: 1.35;
  color: var(--rpip-fg-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ── meta strip: chunks pending / limit countdown / offline ── */
.rpip-meta { display: flex; align-items: center; gap: 10px; min-height: 16px; }
.rpip-meta-item {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500;
  color: var(--rpip-fg-3);
  font-variant-numeric: tabular-nums;
}
.rpip-meta-item--warn { color: var(--rpip-pause); }
.rpip-meta-item--rec { color: var(--rpip-rec); }

/* ── controls ── */
.rpip-controls { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.rpip-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 38px; border-radius: 10px;
  border: 1px solid var(--rpip-border);
  background: var(--rpip-elevated);
  color: var(--rpip-fg);
  font-size: 13px; font-weight: 550;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  user-select: none;
  -webkit-user-select: none;
}
.rpip-btn:hover { background: hsl(240 7% 17%); border-color: var(--rpip-border-strong); }
.rpip-btn:active { background: hsl(240 7% 15%); }
.rpip-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--rpip-canvas), 0 0 0 4px var(--rpip-ring); }
.rpip-btn--grow { flex: 1; }
.rpip-btn--icon { width: 38px; padding: 0; flex: none; }
.rpip-btn--primary {
  background: var(--rpip-fg);
  color: var(--rpip-canvas);
  border-color: var(--rpip-fg);
}
.rpip-btn--primary:hover { background: hsl(240 6% 88%); border-color: hsl(240 6% 88%); }
.rpip-btn--stop {
  background: var(--rpip-rec-soft);
  border-color: hsl(0 84% 62% / 0.3);
  color: var(--rpip-rec);
}
.rpip-btn--stop:hover { background: hsl(0 84% 62% / 0.2); border-color: hsl(0 84% 62% / 0.5); }
.rpip-btn--ghost { background: transparent; border-color: transparent; color: var(--rpip-fg-3); }
.rpip-btn--ghost:hover { background: var(--rpip-elevated); color: var(--rpip-fg); }
/* quiet: pause/resume are secondary during a live recording — finalize owns emphasis */
.rpip-btn--quiet { background: transparent; border-color: var(--rpip-border); color: var(--rpip-fg-2); }
.rpip-btn--quiet:hover { background: var(--rpip-elevated); border-color: var(--rpip-border-strong); color: var(--rpip-fg); }

.rpip-popout {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 7px;
  border: none; background: transparent; color: var(--rpip-fg-3);
  cursor: pointer; transition: background 120ms ease, color 120ms ease;
}
.rpip-popout:hover { background: var(--rpip-elevated); color: var(--rpip-fg); }
.rpip-popout:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--rpip-canvas), 0 0 0 4px var(--rpip-ring); }

/* ── health pill (header) — affirmative is quiet, deviations earn the ink ── */
.rpip-health {
  display: inline-flex; align-items: center; gap: 6px;
  height: 22px; padding: 0 8px 0 7px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 10.5px; font-weight: 550; letter-spacing: 0.01em;
  color: var(--rpip-fg-3);
  cursor: default;
}
.rpip-health[data-overall="warning"] {
  color: var(--rpip-pause);
  background: var(--rpip-pause-soft);
  border-color: hsl(38 95% 55% / 0.3);
}
.rpip-health[data-overall="critical"] {
  color: var(--rpip-rec);
  background: var(--rpip-rec-soft);
  border-color: hsl(0 84% 62% / 0.32);
}
.rpip-health-dot { width: 6px; height: 6px; border-radius: 999px; }
.rpip-health-dot--ok { background: var(--rpip-ok); }
.rpip-health-dot--warning { background: var(--rpip-pause); box-shadow: 0 0 0 2px hsl(38 95% 55% / 0.28); }
.rpip-health-dot--critical { background: var(--rpip-rec); box-shadow: 0 0 0 3px hsl(0 84% 62% / 0.32); }

/* ── processing / done / error bodies ── */
.rpip-process-head { display: flex; align-items: center; gap: 9px; }
.rpip-process-icon { flex: none; }
.rpip-spin { animation: rpipSpin 0.9s linear infinite; }
@keyframes rpipSpin { to { transform: rotate(360deg); } }
.rpip-process-label { font-size: 14px; font-weight: 600; color: var(--rpip-fg); }
.rpip-process-sub { font-size: 11.5px; color: var(--rpip-fg-3); line-height: 1.4; }

.rpip-progress-track {
  height: 4px; border-radius: 999px;
  background: var(--rpip-elevated);
  overflow: hidden; position: relative;
}
.rpip-progress-fill {
  position: absolute; inset: 0;
  width: 40%; border-radius: 999px;
  background: var(--rpip-info);
  animation: rpipIndeterminate 1.5s cubic-bezier(0.4,0,0.2,1) infinite;
}
@keyframes rpipIndeterminate {
  0% { left: -40%; } 100% { left: 100%; }
}

.rpip-error-banner {
  display: flex; gap: 10px;
  padding: 11px 12px;
  border-radius: 11px;
  background: var(--rpip-rec-soft);
  border: 1px solid hsl(0 84% 62% / 0.32);
}
.rpip-error-icon { flex: none; color: var(--rpip-rec); margin-top: 1px; }
.rpip-error-title { font-size: 13px; font-weight: 650; color: var(--rpip-fg); }
.rpip-error-msg { font-size: 11.5px; line-height: 1.45; color: var(--rpip-fg-2); margin-top: 2px; word-break: break-word; }

.rpip-done-icon { color: var(--rpip-ok); flex: none; }

/* reduced motion — only the kept loaders (spin/progress) need taming */
@media (prefers-reduced-motion: reduce) {
  .rpip-spin,
  .rpip-progress-fill { animation: none !important; }
}
`;

const PIP_CANVAS = 'hsl(240 10% 4%)';

function useInjectedStyle(doc: Document | undefined) {
  useEffect(() => {
    const d = doc ?? document;

    // A PiP document owns its own html/body that inherit nothing and default to
    // white. Paint them directly with the dark canvas — a CSS rule can't, because
    // `body` is not a descendant of `.rpip-root`. Without this an always-on-top
    // white halo flickers around the window (issue #71 B2). Host doc untouched.
    if (d !== document) {
      d.documentElement.style.background = PIP_CANVAS;
      d.body.style.background = PIP_CANVAS;
      d.body.style.margin = '0';
    }

    if (d.getElementById(STYLE_ID)) return;
    const el = d.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    d.head.appendChild(el);
    return () => {
      // only remove if we're tearing down a PiP doc; keep host style cached
      if (doc && doc !== document) el.remove();
    };
  }, [doc]);
}

/* ── health summary text ── */
function healthSummary(overall: HealthStatus, checks: RecordingHealth['checks']): string {
  if (overall === 'ok') return 'Tudo certo';
  const firstBad = Object.values(checks).find((c) => c.status !== 'ok');
  if (!firstBad) return overall === 'warning' ? 'Atenção' : 'Crítico';
  return firstBad.message ?? (overall === 'warning' ? 'Atenção' : 'Crítico');
}

/* ── friendly error decode: turn raw pipeline errors into action copy ── */
function decodeError(raw: string | null, isOffline: boolean): { title: string; body: string; canRetry: boolean } {
  if (isOffline) {
    return {
      title: 'Sem conexão',
      body: 'A gravação está salva localmente. Reconecte e ela termina de enviar sozinha.',
      canRetry: true,
    };
  }
  const msg = (raw ?? '').toLowerCase();
  if (msg.includes('auth') || msg.includes('token') || msg.includes('401') || msg.includes('jwt')) {
    return {
      title: 'Sessão expirou',
      body: 'Sua sessão caiu durante o envio. Faça login de novo — a gravação está salva localmente.',
      canRetry: true,
    };
  }
  if (msg.includes('upload') || msg.includes('storage') || msg.includes('network') || msg.includes('fetch')) {
    return {
      title: 'Falha no envio',
      body: 'Não consegui enviar a gravação. Ela está salva localmente. Tente reenviar.',
      canRetry: true,
    };
  }
  return {
    title: 'Algo deu errado',
    body: raw?.trim()
      ? raw
      : 'A gravação foi interrompida por um erro inesperado. O que foi capturado está salvo localmente.',
    canRetry: true,
  };
}

export function RecordingPiPOverlay({
  variant = 'pip',
  targetDocument,
  overlayState,
  durationSeconds,
  title,
  pendingChunkCount,
  isOffline,
  isApproachingLimit,
  remainingSeconds,
  health,
  assemblyStage,
  errorMessage,
  onPause,
  onResume,
  onStop,
  onCancel,
  onRetry,
  onDismiss,
  onPopOut,
}: RecordingPiPOverlayProps) {
  useInjectedStyle(targetDocument);

  const isRecording = overlayState === 'recording';
  const isPaused = overlayState === 'paused';
  const isLive = isRecording || isPaused;

  const decoded = useMemo(
    () => decodeError(errorMessage, isOffline),
    [errorMessage, isOffline],
  );

  // A PiP window the user isn't looking at must pull focus to its recovery
  // action the moment a pipeline error lands (issue #71 A3).
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (overlayState === 'error') retryRef.current?.focus();
  }, [overlayState]);

  // keyboard: Space toggles pause/resume while live (PiP windows are focusable)
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || !isLive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        e.preventDefault();
        if (isRecording) onPause();
        else onResume();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [isLive, isRecording, onPause, onResume]);

  return (
    <div
      ref={rootRef}
      className="rpip-root"
      data-variant={variant}
      data-state={overlayState}
      tabIndex={-1}
    >
      <div className="rpip-shell">
        <div className="rpip-card">
          {/* ─────────── LIVE: recording / paused ─────────── */}
          {isLive && (
            <>
              <div className="rpip-head">
                <span className={`rpip-dot ${isRecording ? 'rpip-dot--rec' : 'rpip-dot--pause'}`} />
                <span className="rpip-state-word" role="status" aria-live="polite">
                  {isRecording ? 'Gravando' : 'Pausado'}
                </span>
                <span className="rpip-spacer" />
                <span
                  className="rpip-health"
                  data-overall={health.overall}
                  title={healthSummary(health.overall, health.checks)}
                  aria-label={`Saúde da gravação: ${healthSummary(health.overall, health.checks)}`}
                >
                  <span className={`rpip-health-dot rpip-health-dot--${health.overall}`} />
                  {health.overall === 'ok' ? 'OK' : health.overall === 'warning' ? 'Atenção' : 'Erro'}
                </span>
                {variant === 'inline' && onPopOut && (
                  <button className="rpip-popout" onClick={onPopOut} aria-label="Abrir janela flutuante" title="Abrir janela flutuante">
                    <Maximize2 size={14} />
                  </button>
                )}
              </div>

              <div className="rpip-timer" role="timer" aria-live="off">
                {formatDuration(durationSeconds)}
              </div>

              {title && <div className="rpip-title" title={title}>{title}</div>}

              <div className="rpip-meta">
                {isApproachingLimit && (
                  <span className="rpip-meta-item rpip-meta-item--warn">
                    {formatDuration(remainingSeconds)} restantes
                  </span>
                )}
                {pendingChunkCount > 0 && (
                  <span className={`rpip-meta-item ${pendingChunkCount > 20 ? 'rpip-meta-item--warn' : ''}`}>
                    {pendingChunkCount} no envio
                  </span>
                )}
                {isOffline && (
                  <span className="rpip-meta-item rpip-meta-item--rec">
                    <WifiOff size={13} /> Sem rede
                  </span>
                )}
              </div>

              <div className="rpip-controls">
                {isRecording ? (
                  <button className="rpip-btn rpip-btn--quiet rpip-btn--grow" onClick={onPause}>
                    <Pause size={15} /> Pausar
                  </button>
                ) : (
                  <button className="rpip-btn rpip-btn--quiet rpip-btn--grow" onClick={onResume}>
                    <Play size={15} /> Retomar
                  </button>
                )}
                <button className="rpip-btn rpip-btn--stop rpip-btn--grow" onClick={onStop}>
                  <Square size={13} fill="currentColor" /> Finalizar
                </button>
                <button className="rpip-btn rpip-btn--icon rpip-btn--ghost" onClick={onCancel} aria-label="Descartar gravação" title="Descartar gravação">
                  <X size={16} />
                </button>
              </div>
            </>
          )}

          {/* ─────────── PROCESSING ─────────── */}
          {overlayState === 'processing' && (
            <>
              <div className="rpip-head">
                <span className="rpip-state-word" style={{ color: 'var(--rpip-info)' }}>Processando</span>
              </div>
              <div className="rpip-process-head">
                <Loader2 size={18} className="rpip-process-icon rpip-spin" style={{ color: 'var(--rpip-info)' }} />
                <span className="rpip-process-label">{getAssemblyLabel(assemblyStage)}</span>
              </div>
              <div className="rpip-progress-track">
                <div className="rpip-progress-fill" />
              </div>
              <p className="rpip-process-sub">
                Pode fechar esta janela — o processamento continua e a ata aparece em Reuniões Gravadas.
              </p>
            </>
          )}

          {/* ─────────── DONE ─────────── */}
          {overlayState === 'done' && (
            <>
              <div className="rpip-head">
                <span className="rpip-state-word" style={{ color: 'var(--rpip-ok)' }}>Concluído</span>
                <span className="rpip-spacer" />
                {onDismiss && (
                  <button className="rpip-popout" onClick={onDismiss} aria-label="Fechar" title="Fechar">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="rpip-process-head">
                <CheckCircle2 size={18} className="rpip-done-icon" />
                <span className="rpip-process-label">Gravação salva</span>
              </div>
              <p className="rpip-process-sub">
                Disponível em Reuniões Gravadas. A transcrição e a ata são geradas em seguida.
              </p>
            </>
          )}

          {/* ─────────── ERROR ─────────── */}
          {overlayState === 'error' && (
            <>
              <div className="rpip-head">
                <span className="rpip-state-word" style={{ color: 'var(--rpip-rec)' }}>Erro</span>
                <span className="rpip-spacer" />
                {onDismiss && (
                  <button className="rpip-popout" onClick={onDismiss} aria-label="Fechar" title="Fechar">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="rpip-error-banner" role="alert">
                <AlertTriangle size={16} className="rpip-error-icon" />
                <div>
                  <div className="rpip-error-title">{decoded.title}</div>
                  <p className="rpip-error-msg">{decoded.body}</p>
                </div>
              </div>
              <div className="rpip-controls">
                {decoded.canRetry && onRetry && (
                  <button ref={retryRef} className="rpip-btn rpip-btn--primary rpip-btn--grow" onClick={onRetry}>
                    <RefreshCw size={14} /> Tentar de novo
                  </button>
                )}
                {onDismiss && (
                  <button className="rpip-btn rpip-btn--grow" onClick={onDismiss}>
                    Descartar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
