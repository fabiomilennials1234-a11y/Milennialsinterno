/**
 * Pure health-assessment hook for active recordings.
 *
 * Evaluates recorder, network, auth, and upload status.
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

export interface RecordingHealth {
  overall: HealthStatus;
  checks: {
    recorder: RecorderHealthCheck;
    network: HealthCheck;
    auth: AuthHealthCheck;
    upload: UploadHealthCheck;
  };
}

interface UseRecordingHealthOptions {
  videoRecorderState: RecordingState | null;
  audioRecorderState: RecordingState | null;
  videoTrackReadyState: MediaStreamTrackState | null;
  isOffline: boolean;
  consecutiveFailures: number;
  isActive: boolean;
  supabaseClient: SupabaseClient;
}

const AUTH_POLL_INTERVAL = 30_000; // 30s

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
    isActive,
    supabaseClient,
  } = options;

  const [authExpiresIn, setAuthExpiresIn] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Check immediately
    checkAuth();
    pollRef.current = setInterval(checkAuth, AUTH_POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isActive, supabaseClient]);

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

    const overall = worstStatus(recorder.status, network.status, auth.status, upload.status);

    return { overall, checks: { recorder, network, auth, upload } };
  }, [
    isActive,
    videoRecorderState,
    audioRecorderState,
    videoTrackReadyState,
    isOffline,
    consecutiveFailures,
    authExpiresIn,
  ]);

  return health;
}
