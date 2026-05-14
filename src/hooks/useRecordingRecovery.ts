/**
 * Recovery hook for interrupted recordings.
 *
 * On mount, checks IndexedDB for orphaned chunks and DB for incomplete sessions.
 * Exposes recoverable sessions and actions to recover or abandon them.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getOrphanedSessionIds, clearSession } from '@/lib/recordingIDB';
import { useRecordingSession, RecordingSession } from './useRecordingSession';

export interface RecoverableSession {
  session: RecordingSession;
  hasLocalChunks: boolean;
}

interface UseRecordingRecoveryReturn {
  recoverableSessions: RecoverableSession[];
  isChecking: boolean;
  abandonSession: (sessionId: string) => Promise<void>;
  dismissSession: (sessionId: string) => void;
  refresh: () => void;
}

export function useRecordingRecovery(): UseRecordingRecoveryReturn {
  const [recoverableSessions, setRecoverableSessions] = useState<RecoverableSession[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const sessionApi = useRecordingSession();
  const sessionApiRef = useRef(sessionApi);
  sessionApiRef.current = sessionApi;
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const idbSessionIds = await getOrphanedSessionIds();
        const dbSessions = await sessionApiRef.current.getIncompleteSessions();
        if (cancelled) return;

        const recoverable: RecoverableSession[] = [];
        for (const session of dbSessions) {
          recoverable.push({
            session,
            hasLocalChunks: idbSessionIds.includes(session.id),
          });
        }

        const dbSessionIds = new Set(dbSessions.map(s => s.id));
        for (const idbId of idbSessionIds) {
          if (!dbSessionIds.has(idbId)) {
            await clearSession(idbId);
          }
        }

        if (!cancelled) setRecoverableSessions(recoverable);
      } catch (err) {
        console.error('[RecordingRecovery] Check failed:', err);
        if (!cancelled) setRecoverableSessions([]);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const abandonSession = useCallback(async (sessionId: string) => {
    await sessionApiRef.current.abandonSession(sessionId);
    await clearSession(sessionId);
    setRecoverableSessions(prev => prev.filter(s => s.session.id !== sessionId));
  }, []);

  const dismissSession = useCallback((sessionId: string) => {
    setRecoverableSessions(prev => prev.filter(s => s.session.id !== sessionId));
  }, []);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    try {
      const idbSessionIds = await getOrphanedSessionIds();
      const dbSessions = await sessionApiRef.current.getIncompleteSessions();
      const recoverable: RecoverableSession[] = dbSessions.map(session => ({
        session,
        hasLocalChunks: idbSessionIds.includes(session.id),
      }));
      setRecoverableSessions(recoverable);
    } catch (err) {
      console.error('[RecordingRecovery] Refresh failed:', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    recoverableSessions,
    isChecking,
    abandonSession,
    dismissSession,
    refresh,
  };
}
