import { useEffect, useState } from 'react';

export type CountdownSeverity = 'calm' | 'warning' | 'danger';

export interface CountdownState {
  remaining: string;
  severity: CountdownSeverity;
  /** Dias decorridos desde a expiração (0 quando ainda não venceu). */
  expiredDays: number;
  isExpired: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function format(diffMs: number): string {
  if (diffMs <= 0) return '0h';
  if (diffMs >= DAY_MS) {
    const days = Math.floor(diffMs / DAY_MS);
    const hours = Math.floor((diffMs % DAY_MS) / HOUR_MS);
    return `${days}d ${hours}h`;
  }
  const hours = Math.floor(diffMs / HOUR_MS);
  const minutes = Math.floor((diffMs % HOUR_MS) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

function compute(expiresAtIso: string): CountdownState {
  const expiresMs = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresMs)) {
    return { remaining: '0h', severity: 'danger', expiredDays: 0, isExpired: true };
  }
  const diff = expiresMs - Date.now();
  if (diff <= 0) {
    const expiredDays = Math.floor(Math.abs(diff) / DAY_MS);
    return { remaining: '0h', severity: 'danger', expiredDays, isExpired: true };
  }
  const severity: CountdownSeverity =
    diff <= DAY_MS ? 'danger' : diff <= 3 * DAY_MS ? 'warning' : 'calm';
  return { remaining: format(diff), severity, expiredDays: 0, isExpired: false };
}

/**
 * Re-render a cada 60s para manter o cronômetro vivo.
 * `expiresAt` ISO string vinda do DB. Sem `expiresAt` retorna estado neutro.
 */
export function useCountdown(expiresAt: string | null | undefined): CountdownState {
  const [state, setState] = useState<CountdownState>(() =>
    expiresAt ? compute(expiresAt) : { remaining: '', severity: 'calm', expiredDays: 0, isExpired: false },
  );

  useEffect(() => {
    if (!expiresAt) {
      setState({ remaining: '', severity: 'calm', expiredDays: 0, isExpired: false });
      return;
    }
    setState(compute(expiresAt));
    const interval = setInterval(() => setState(compute(expiresAt)), 60 * 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return state;
}
