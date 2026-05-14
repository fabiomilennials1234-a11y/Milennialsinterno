/**
 * Banner shown when interrupted recording sessions are detected.
 * Offers to recover (re-upload + assemble) or discard.
 */
import { useState, useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecoverableSession } from '@/hooks/useRecordingRecovery';
import { useChunkUploader } from '@/hooks/useChunkUploader';
import { useRecordingAssembly } from '@/hooks/useRecordingAssembly';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { clearSession } from '@/lib/recordingIDB';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface RecordingRecoveryBannerProps {
  sessions: RecoverableSession[];
  onAbandon: (sessionId: string) => Promise<void>;
  onDismiss: (sessionId: string) => void;
}

export default function RecordingRecoveryBanner({
  sessions,
  onAbandon,
  onDismiss,
}: RecordingRecoveryBannerProps) {
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [abandoningId, setAbandoningId] = useState<string | null>(null);
  const uploader = useChunkUploader();
  const assembly = useRecordingAssembly();
  const sessionApi = useRecordingSession();
  const queryClient = useQueryClient();

  const toastFiredRef = useRef(false);
  useEffect(() => {
    if (sessions.length > 0 && !toastFiredRef.current) {
      toastFiredRef.current = true;
      toast.warning(
        `${sessions.length} gravação interrompida detectada. Recupere ou descarte no banner acima.`,
        { duration: 15000, id: 'recovery-alert' },
      );
    }
  }, [sessions.length]);

  if (sessions.length === 0) return null;

  const handleRecover = async (recoverable: RecoverableSession) => {
    const { session } = recoverable;
    setRecoveringId(session.id);

    try {
      // 1. Upload any remaining IDB chunks
      if (recoverable.hasLocalChunks) {
        await uploader.uploadPendingFromIDB(session.id, session.storage_prefix);
      }

      // 2. Stop session if still in recording state
      if (session.status === 'recording') {
        await sessionApi.stopSession(session.id, session.duration_seconds ?? 0);
      }

      // 3. Assemble
      const meetingId = await assembly.assemble({
        sessionId: session.id,
        storagePrefix: session.storage_prefix,
        videoChunkCount: session.chunk_count,
        audioChunkCount: session.chunk_count, // symmetric
        durationSeconds: session.duration_seconds ?? 0,
        title: session.title,
        folderId: session.folder_id,
        clientId: session.client_id,
      });

      // 4. Cleanup IDB
      await clearSession(session.id);

      queryClient.invalidateQueries({ queryKey: ['recorded-meetings'] });
      toast.success(`Gravacao "${session.title}" recuperada com sucesso!`);
      onDismiss(session.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na recuperacao';
      toast.error('Falha ao recuperar gravacao: ' + msg);
      await sessionApi.markFailed(session.id, msg);
    } finally {
      setRecoveringId(null);
    }
  };

  const handleAbandon = async (sessionId: string) => {
    setAbandoningId(sessionId);
    try {
      await onAbandon(sessionId);
      toast.success('Gravacao descartada');
    } catch {
      toast.error('Erro ao descartar gravacao');
    } finally {
      setAbandoningId(null);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg space-y-2 px-4">
      {sessions.map((recoverable) => {
        const { session } = recoverable;
        const isRecovering = recoveringId === session.id;
        const isAbandoning = abandoningId === session.id;
        const busy = isRecovering || isAbandoning;

        return (
          <div
            key={session.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-amber-500/30 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <AlertCircle size={18} className="text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {session.title}
              </p>
              <p className="text-xs text-muted-foreground">
                Gravacao interrompida
                {session.duration_seconds
                  ? ` — ${Math.floor(session.duration_seconds / 60)}min gravados`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRecover(recoverable)}
                disabled={busy}
                className="h-7 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
              >
                {isRecovering ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <RefreshCw size={12} className="mr-1" />
                )}
                Recuperar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAbandon(session.id)}
                disabled={busy}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                {isAbandoning ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
