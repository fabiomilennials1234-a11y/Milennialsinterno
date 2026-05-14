/**
 * Pure health-assessment hook for active recordings.
 *
 * Evaluates recorder, network, auth, upload, storage, and chunks status.
 * No side-effects (no toasts, no actions) — consumers react to the output.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type HealthStatus = 'ok' | 'warning' | 'critical';

export interface HealthCheck {
  status: HealthStatus;
  message?: string;
}

export interface RecorderHealthCheck extends HealthCheck {
  recorderState?: string;
}

export interface AuthHealthCheck extends HealthCheck {
  expiresInSeconds: number | null;
}

export interface UploadHealthCheck extends HealthCheck {
  consecutiveFailures: number;
}

export interface StorageHealthCheck extends HealthCheck {
  usagePercent: number;
  availableMB: number;
}

export interface ChunksHealthCheck extends HealthCheck {
  pending: number;
  trend: 'stable' | 'growing' | 'shrinking';
}

export interface RecordingHealth {
  overall: HealthStatus;
  checks: {
    recorder: RecorderHealthCheck;
    network: HealthCheck;
    auth: AuthHealthCheck;
    upload: UploadHealthCheck;
    storage: StorageHealthCheck;
    chunks: ChunksHealthCheck;
  };
}

interface UseRecordingHealthOptions {
  videoRecorderState: RecordingState | null;
  audioRecorderState: RecordingState | null;
  videoTrackReadyState: MediaStreamTrackState | null;
  isOffline: boolean;
  consecutiveFailures: number;
  pendingChunkCount: number;
  isActive: boolean;
  supabaseClient: SupabaseClient;
}

const AUTH_POLL_INTERVAL = 30_000; // 30s
const STORAGE_POLL_INTERVAL = 60_000; // 60s
const CHUNKS_TREND_INTERVAL = 30_000; // 30s — snapshot window

function worstStatus(...statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  return 'ok';
}

export function useRecordingHealth(options: UseRecordingHealthOptions): RecordingHealth {
  const {
    videoRecorderState,
    audioRecorderState,
    videoTrackReadyState,
    isOffline,
    consecutiveFailures,
    pendingChunkCount,
    isActive,
    supabaseClient,
  } = options;

  const [authExpiresIn, setAuthExpiresIn] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Storage state ──
  const [storageUsagePercent, setStorageUsagePercent] = useState(0);
  const [storageAvailableMB, setStorageAvailableMB] = useState(0);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const storagePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Chunks trend state ──
  const prevPendingRef = useRef<number>(0);
  const prevPendingTimestampRef = useRef<number>(Date.now());
  const [chunksTrend, setChunksTrend] = useState<'stable' | 'growing' | 'shrinking'>('stable');
  const [growingDurationMs, setGrowingDurationMs] = useState(0);
  const growingStartRef = useRef<number | null>(null);
  const chunksTrendPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth polling ──
  useEffect(() => {
    if (!isActive) {
      setAuthExpiresIn(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.expires_at) {
          const expiresIn = session.expires_at - Math.floor(Date.now() / 1000);
          setAuthExpiresIn(expiresIn);
        } else {
          setAuthExpiresIn(null);
        }
      } catch {
        setAuthExpiresIn(null);
      }
    };

    checkAuth();
    pollRef.current = setInterval(checkAuth, AUTH_POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isActive, supabaseClient]);

  // ── Storage polling ──
  useEffect(() => {
    if (!isActive) {
      setStorageUsagePercent(0);
      setStorageAvailableMB(0);
      setStorageAvailable(true);
      if (storagePollRef.current) {
        clearInterval(storagePollRef.current);
        storagePollRef.current = null;
      }
      return;
    }

    const checkStorage = async () => {
      if (!navigator.storage?.estimate) {
        setStorageAvailable(false);
        return;
      }

      try {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota ?? 0;
        const usage = estimate.usage ?? 0;

        if (quota > 0) {
          setStorageUsagePercent(Math.round((usage / quota) * 100));
          setStorageAvailableMB(Math.round((quota - usage) / (1024 * 1024)));
        } else {
          setStorageAvailable(false);
        }
      } catch {
        setStorageAvailable(false);
      }
    };

    checkStorage();
    storagePollRef.current = setInterval(checkStorage, STORAGE_POLL_INTERVAL);

    return () => {
      if (storagePollRef.current) {
        clearInterval(storagePollRef.current);
        storagePollRef.current = null;
      }
    };
  }, [isActive]);

  // ── Chunks trend tracking ──
  useEffect(() => {
    if (!isActive) {
      setChunksTrend('stable');
      setGrowingDurationMs(0);
      growingStartRef.current = null;
      prevPendingRef.current = 0;
      prevPendingTimestampRef.current = Date.now();
      if (chunksTrendPollRef.current) {
        clearInterval(chunksTrendPollRef.current);
        chunksTrendPollRef.current = null;
      }
      return;
    }

    prevPendingRef.current = pendingChunkCount;
    prevPendingTimestampRef.current = Date.now();

    const checkTrend = () => {
      const prev = prevPendingRef.current;
      const current = pendingChunkCount;
      const now = Date.now();

      let newTrend: 'stable' | 'growing' | 'shrinking';
      if (current > prev) {
        newTrend = 'growing';
      } else if (current < prev) {
        newTrend = 'shrinking';
      } else {
        newTrend = 'stable';
      }

      if (newTrend === 'growing') {
        if (!growingStartRef.current) {
          growingStartRef.current = now;
        }
        setGrowingDurationMs(now - growingStartRef.current);
      } else {
        growingStartRef.current = null;
        setGrowingDurationMs(0);
      }

      setChunksTrend(newTrend);
      prevPendingRef.current = current;
      prevPendingTimestampRef.current = now;
    };

    chunksTrendPollRef.current = setInterval(checkTrend, CHUNKS_TREND_INTERVAL);

    return () => {
      if (chunksTrendPollRef.current) {
        clearInterval(chunksTrendPollRef.current);
        chunksTrendPollRef.current = null;
      }
    };
  }, [isActive, pendingChunkCount]);

  // ── Compute health checks ──
  const health = useMemo((): RecordingHealth => {
    // Recorder check
    const recorder: RecorderHealthCheck = (() => {
      if (!isActive) {
        return { status: 'ok' as const, recorderState: videoRecorderState ?? undefined };
      }

      if (videoRecorderState === 'inactive') {
        return {
          status: 'critical' as const,
          message: 'MediaRecorder parou inesperadamente',
          recorderState: videoRecorderState,
        };
      }

      if (videoTrackReadyState === 'ended') {
        return {
          status: 'warning' as const,
          message: 'Video track encerrada',
          recorderState: videoRecorderState ?? undefined,
        };
      }

      if (videoRecorderState === 'recording' || videoRecorderState === 'paused') {
        return { status: 'ok' as const, recorderState: videoRecorderState };
      }

      return { status: 'ok' as const, recorderState: videoRecorderState ?? undefined };
    })();

    // Network check
    const network: HealthCheck = isOffline
      ? { status: 'critical', message: 'Sem conexao de rede' }
      : { status: 'ok' };

    // Auth check
    const auth: AuthHealthCheck = (() => {
      if (authExpiresIn === null) {
        return isActive
          ? { status: 'critical' as const, expiresInSeconds: null, message: 'Sessao nao encontrada' }
          : { status: 'ok' as const, expiresInSeconds: null };
      }

      if (authExpiresIn < 120) {
        return {
          status: 'critical' as const,
          expiresInSeconds: authExpiresIn,
          message: `Token expira em ${authExpiresIn}s`,
        };
      }

      if (authExpiresIn < 600) {
        return {
          status: 'warning' as const,
          expiresInSeconds: authExpiresIn,
          message: `Token expira em ${Math.floor(authExpiresIn / 60)}min`,
        };
      }

      return { status: 'ok' as const, expiresInSeconds: authExpiresIn };
    })();

    // Upload check
    const upload: UploadHealthCheck = (() => {
      if (consecutiveFailures === 0) {
        return { status: 'ok' as const, consecutiveFailures: 0 };
      }
      if (consecutiveFailures <= 3) {
        return {
          status: 'warning' as const,
          consecutiveFailures,
          message: `${consecutiveFailures} upload(s) consecutivo(s) falharam`,
        };
      }
      return {
        status: 'critical' as const,
        consecutiveFailures,
        message: `${consecutiveFailures} uploads consecutivos falharam`,
      };
    })();

    // Storage check
    const storage: StorageHealthCheck = (() => {
      if (!storageAvailable) {
        return {
          status: 'ok' as const,
          usagePercent: 0,
          availableMB: 0,
          message: 'Monitoramento indisponivel',
        };
      }

      if (storageUsagePercent > 90) {
        return {
          status: 'critical' as const,
          usagePercent: storageUsagePercent,
          availableMB: storageAvailableMB,
          message: `${storageUsagePercent}% em uso — ${storageAvailableMB}MB livres`,
        };
      }

      if (storageUsagePercent >= 70) {
        return {
          status: 'warning' as const,
          usagePercent: storageUsagePercent,
          availableMB: storageAvailableMB,
          message: `${storageUsagePercent}% em uso — ${storageAvailableMB}MB livres`,
        };
      }

      return {
        status: 'ok' as const,
        usagePercent: storageUsagePercent,
        availableMB: storageAvailableMB,
      };
    })();

    // Chunks trend check
    const chunks: ChunksHealthCheck = (() => {
      if (pendingChunkCount > 50 || (chunksTrend === 'growing' && growingDurationMs > 60_000)) {
        return {
          status: 'critical' as const,
          pending: pendingChunkCount,
          trend: chunksTrend,
          message: pendingChunkCount > 50
            ? `${pendingChunkCount} chunks pendentes`
            : 'Fila crescendo ha mais de 1min',
        };
      }

      if (
        (pendingChunkCount >= 20 && pendingChunkCount <= 50) ||
        (chunksTrend === 'growing' && growingDurationMs > 30_000)
      ) {
        return {
          status: 'warning' as const,
          pending: pendingChunkCount,
          trend: chunksTrend,
          message: pendingChunkCount >= 20
            ? `${pendingChunkCount} chunks pendentes`
            : 'Fila crescendo ha mais de 30s',
        };
      }

      return {
        status: 'ok' as const,
        pending: pendingChunkCount,
        trend: chunksTrend,
      };
    })();

    const overall = worstStatus(
      recorder.status,
      network.status,
      auth.status,
      upload.status,
      storage.status,
      chunks.status,
    );

    return { overall, checks: { recorder, network, auth, upload, storage, chunks } };
  }, [
    isActive,
    videoRecorderState,
    audioRecorderState,
    videoTrackReadyState,
    isOffline,
    consecutiveFailures,
    authExpiresIn,
    storageAvailable,
    storageUsagePercent,
    storageAvailableMB,
    pendingChunkCount,
    chunksTrend,
    growingDurationMs,
  ]);

  return health;
}
