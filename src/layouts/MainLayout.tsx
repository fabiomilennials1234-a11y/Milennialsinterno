import { ReactNode } from 'react';
import AppSidebar from '@/components/layout/AppSidebar';
import AppHeader from '@/components/layout/AppHeader';
import ChurnNotificationModal from '@/components/ChurnNotificationModal';
import TaskDelayModal from '@/components/TaskDelayModal';
import { useDesignCompletionToasts } from '@/hooks/useDesignCompletionNotifications';
import { useVideoCompletionToasts } from '@/hooks/useVideoCompletionNotifications';
import { useDevCompletionToasts } from '@/hooks/useDevsCompletionNotifications';
import { useAtrizesCompletionToasts } from '@/hooks/useAtrizesCompletionNotifications';
import { useProdutoraCompletionToasts } from '@/hooks/useProdutoraCompletionNotifications';
import { useAdsNoteNotifications } from '@/hooks/useAdsNoteNotifications';

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
  // Show atrizes completion toasts globally
  useAtrizesCompletionToasts();
  // Show produtora completion toasts globally
  useProdutoraCompletionToasts();
  // Listen for ads note notifications (creates toasts via realtime)
  useAdsNoteNotifications();
  return (
    <div className="h-screen max-h-screen flex bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto scrollbar-elegant">
          {children}
        </main>
      </div>
      
      {/* Churn Notification Modal - appears globally */}
      <ChurnNotificationModal />
      
      {/* Task Delay Modal - appears globally for all roles */}
      <TaskDelayModal />
    </div>
  );
}
