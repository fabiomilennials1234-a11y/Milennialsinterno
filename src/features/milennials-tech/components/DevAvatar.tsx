import { cn } from '@/lib/utils';
import { getInitials } from '../hooks/useProfiles';

// ---------------------------------------------------------------------------
// DevAvatar (#165) — identity chip for the team report rows.
//
// The tech RPCs expose only assignee_id; name is resolved client-side via
// profiles (useProfileMap), exactly as TaskCard does. There is no avatar image
// in the profile, so identity reads as initials on the elevated surface — the
// same chip the board uses, sized up for a reporting context where the dev is
// the row's subject, not a corner annotation.
// ---------------------------------------------------------------------------

export function DevAvatar({
  name,
  size = 32,
  className,
}: {
  /** Resolved display name, or null when the user was removed. */
  name: string | null;
  /** Square px size of the chip. */
  size?: number;
  className?: string;
}) {
  const initials = name ? getInitials(name) : '??';

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        'flex-shrink-0 inline-flex items-center justify-center rounded-full select-none',
        'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)]',
        'text-[11px] font-semibold text-[var(--mtech-text-muted)]',
        className,
      )}
    >
      {initials}
    </span>
  );
}
