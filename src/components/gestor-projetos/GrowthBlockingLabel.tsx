import { cn } from '@/lib/utils';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface GrowthBlockingLabelProps {
  text: string;
  variant: 'danger' | 'warning';
  pulsing?: boolean;
}

const VARIANT_STYLES = {
  danger: {
    container: 'bg-danger/10 border-danger/40 text-danger',
    icon: 'text-danger',
    pulseClass: 'growth-blocking-pulse-danger',
  },
  warning: {
    container: 'bg-warning/10 border-warning/40 text-warning',
    icon: 'text-warning',
    pulseClass: 'growth-blocking-pulse-warning',
  },
} as const;

export default function GrowthBlockingLabel({
  text,
  variant,
  pulsing = true,
}: GrowthBlockingLabelProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = variant === 'danger' ? ShieldAlert : AlertTriangle;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border font-bold text-xs uppercase tracking-wider leading-tight select-none',
        styles.container,
        pulsing && styles.pulseClass,
      )}
    >
      <Icon size={14} className={cn(styles.icon, 'shrink-0')} />
      <span className="truncate">{text}</span>
    </div>
  );
}
