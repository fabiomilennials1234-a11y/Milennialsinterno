import { NavLink } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJustificativasCount } from '@/hooks/useJustificativas';

export default function SidebarBadge() {
  const { data: count = 0 } = useJustificativasCount();

  if (!count || count <= 0) return null;

  return (
    <NavLink
      to="/justificativas"
      className={({ isActive }) =>
        cn(
          'flex items-center justify-between gap-2 px-3 py-2 mx-3 mb-2 rounded-lg',
          'border border-danger/40 bg-danger/10 hover:bg-danger/15 transition-colors',
          'text-sm font-medium text-sidebar-foreground',
          isActive && 'bg-danger/20 border-danger'
        )
      }
    >
      <span className="flex items-center gap-2 min-w-0">
        <AlertTriangle size={16} className="text-danger flex-shrink-0" />
        <span className="truncate">Justificativas</span>
      </span>
      <span
        aria-label={`${count} pendentes`}
        className="bg-danger text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center flex-shrink-0"
      >
        {count}
      </span>
    </NavLink>
  );
}
