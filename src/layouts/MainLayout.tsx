import { ReactNode } from 'react';
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';
// ChurnNotificationModal removed — churn alerts now appear in Justificativas page
import { useDesignCompletionToasts } from '@/hooks/useDesignCompletionNotifications';
import { useVideoCompletionToasts } from '@/hooks/useVideoCompletionNotifications';
import { useDevCompletionToasts } from '@/hooks/useDevsCompletionNotifications';
import { useProdutoraCompletionToasts } from '@/hooks/useProdutoraCompletionNotifications';
import { useAdsNoteNotifications } from '@/hooks/useAdsNoteNotifications';
import { useAdsNewClientNotifications } from '@/hooks/useAdsNewClientNotifications';
import { useAssignedClientsRealtime } from '@/hooks/useAssignedClientsRealtime';
import { useSidebarRealtime } from '@/hooks/useSidebarRealtime';
import { useTrainingReminderToasts } from '@/hooks/useTrainingReminderToasts';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  // Show design completion toasts globally (for requesters who briefed demands)
  useDesignCompletionToasts();
  // Show video completion toasts globally
  useVideoCompletionToasts();
  // Show dev completion toasts globally
  useDevCompletionToasts();
  // Show produtora completion toasts globally
  useProdutoraCompletionToasts();
  // Listen for ads note notifications (creates toasts via realtime)
  useAdsNoteNotifications();
  // Listen for new client assignments to ads manager (creates toasts via realtime)
  useAdsNewClientNotifications();
  // Realtime: atualiza lista de clientes do gestor de ads quando novo cliente é atribuído
  useAssignedClientsRealtime();
  // Realtime updates for sidebar when users/groups/squads change
  useSidebarRealtime();
  // Show training reminder toasts (push visual na tela)
  useTrainingReminderToasts();
  return (
    <div className="h-screen max-h-screen flex bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto scrollbar-elegant">
          {children}
        </main>
      </div>

      {/* Churn alerts moved to /justificativas page */}
    </div>
  );
}
