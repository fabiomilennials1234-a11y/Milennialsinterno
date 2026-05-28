import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const LS_KEY = 'meta-ads-last-sync';

function getLastSyncAt(): number {
  const stored = localStorage.getItem(LS_KEY);
  return stored ? Number(stored) : 0;
}

export function useMetaAdsSync() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(getLastSyncAt);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Update cooldown timer
  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - lastSyncAt;
      const remaining = Math.max(0, COOLDOWN_MS - elapsed);
      setCooldownRemaining(remaining);
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [lastSyncAt]);

  const canSync = cooldownRemaining === 0 && !isSyncing;

  const sync = useCallback(async (opts?: { mode?: 'leads' | 'insights' | 'full' | 'backfill' }) => {
    if (!canSync) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-meta-ads', {
        body: { mode: opts?.mode ?? 'full' },
      });

      if (error) {
        throw new Error(error.message || 'Sync failed');
      }

      // Check for API-level errors in response
      if (data?.error) {
        throw new Error(data.error);
      }

      const now = Date.now();
      localStorage.setItem(LS_KEY, String(now));
      setLastSyncAt(now);

      // Invalidate insights queries to refetch
      queryClient.invalidateQueries({ queryKey: ['meta-ads-insights'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown sync error';
      setSyncError(msg);
      console.error('[useMetaAdsSync]', msg);
    } finally {
      setIsSyncing(false);
    }
  }, [canSync, queryClient]);

  return {
    sync,
    isSyncing,
    lastSyncAt,
    cooldownRemaining,
    canSync,
    syncError,
  };
}
