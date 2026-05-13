/**
 * Recovery hook for interrupted recordings.
 *
 * On mount, checks IndexedDB for orphaned chunks and DB for incomplete sessions.
 * Exposes recoverable sessions and actions to recover or abandon them.
 */
import { useState, useEffect, useCallback } from 'react';
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
  const [refreshKey, setRefreshKey] = useState(0);
  const sessionApi = useRecordingSession();

  const check = useCallback(async () => {
    setIsChecking(true);
    try {
      // 1. Get session IDs from IndexedDB
      const idbSessionIds = await getOrphanedSessionIds();

      // 2. Get incomplete sessions from DB
      const dbSessions = await sessionApi.getIncompleteSessions();

      // 3. Merge: a session is recoverable if it exists in DB with incomplete status
      const recoverable: RecoverableSession[] = [];

      for (const session of dbSessions) {
        recoverable.push({
          session,
          hasLocalChunks: idbSessionIds.includes(session.id),
        });
      }

      // 4. IDB sessions not in DB are orphaned — clean them up silently
      const dbSessionIds = new Set(dbSessions.map(s => s.id));
      for (const idbId of idbSessionIds) {
        if (!dbSessionIds.has(idbId)) {
          await clearSession(idbId);
        }
      }

      setRecoverableSessions(recoverable);
    } catch (err) {
      console.error('[RecordingRecovery] Check failed:', err);
      setRecoverableSessions([]);
    } finally {
      setIsChecking(false);
    }
  }, [sessionApi]);

  useEffect(() => {
    check();
  }, [check, refreshKey]);

  const abandonSession = useCallback(async (sessionId: string) => {
    await sessionApi.abandonSession(sessionId);
    await clearSession(sessionId);
    setRecoverableSessions(prev => prev.filter(s => s.session.id !== sessionId));
  }, [sessionApi]);

  const dismissSession = useCallback((sessionId: string) => {
    setRecoverableSessions(prev => prev.filter(s => s.session.id !== sessionId));
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return {
    recoverableSessions,
    isChecking,
    abandonSession,
    dismissSession,
    refresh,
  };
}
