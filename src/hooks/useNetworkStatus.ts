import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UseNetworkStatusReturn {
  isOffline: boolean;
}

/**
 * Tracks browser online/offline state and shows contextual toasts
 * when network drops or recovers during an active recording.
 *
 * @param isActive - Whether the recording is active (recording or paused).
 *                   Toasts only fire when true.
 */
export function useNetworkStatus(isActive: boolean): UseNetworkStatusReturn {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const offlineToastShownRef = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      if (isActive && !offlineToastShownRef.current) {
        offlineToastShownRef.current = true;
        toast.error('Conexao perdida — chunks sendo salvos localmente. Reconecte para nao perder dados.', {
          duration: Infinity,
          id: 'recording-offline',
        });
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      offlineToastShownRef.current = false;
      if (isActive) {
        toast.success('Conexao restaurada — upload de chunks retomado.', {
          id: 'recording-offline',
          duration: 4000,
        });
      } else {
        toast.dismiss('recording-offline');
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [isActive]);

  return { isOffline };
}
