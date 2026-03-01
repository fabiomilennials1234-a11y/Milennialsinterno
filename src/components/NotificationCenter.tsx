import { useState } from 'react';
import { Bell, Check, BellOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationCenter, type UnifiedNotification } from '@/hooks/useNotificationCenter';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}sem`;
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: UnifiedNotification;
  onMarkAsRead: (id: string, type: UnifiedNotification['type']) => void;
}) {
  const Icon = notification.icon;
  const isChurn = notification.type === 'churn';

  return (
    <button
      onClick={() => !isChurn && onMarkAsRead(notification.id, notification.type)}
      className={`w-full flex items-start gap-3 p-3 text-left transition-colors rounded-lg
        ${isChurn ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50'}
        bg-primary/[0.03]`}
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ backgroundColor: `${notification.color}15` }}
      >
        <Icon size={16} style={{ color: notification.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {notification.title}
          </p>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {timeAgo(notification.created_at)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.description}
        </p>
      </div>
    </button>
  );
}

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationCenter();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 bg-popover border-border shadow-apple-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
            Notificações
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check size={14} />
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <BellOff size={32} className="text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma notificação pendente
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={`${notification.type}-${notification.id}`}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {unreadCount} {unreadCount === 1 ? 'notificação pendente' : 'notificações pendentes'}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
