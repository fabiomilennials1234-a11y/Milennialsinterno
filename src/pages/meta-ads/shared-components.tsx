import { cn } from '@/lib/utils';

// ---------- Accent map for dashboard-card ----------

const ACCENT_MAP: Record<string, string> = {
  default: 'primary',
  success: 'success',
  warning: 'warning',
  destructive: 'danger',
  info: 'info',
};

// ---------- MetricCard ----------

export function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  variant = 'default',
  animDelay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  animDelay?: number;
}) {
  const variantStyles: Record<string, string> = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
  };
  const iconBgStyles: Record<string, string> = {
    default: 'bg-primary/10',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
    destructive: 'bg-destructive/10',
    info: 'bg-info/10',
  };

  return (
    <div
      className="dashboard-card dash-card-animate p-4"
      data-accent={ACCENT_MAP[variant]}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-xl', iconBgStyles[variant])}>
          <Icon size={14} className={variantStyles[variant]} />
        </div>
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <p className={cn('text-xl font-bold', variantStyles[variant])}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
    </div>
  );
}

// ---------- SectionHeader ----------

export function SectionHeader({ title, icon: Icon, color = 'primary' }: { title: string; icon: React.ElementType; color?: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="dashboard-section-header">
      <div className={cn('icon-circle', colorMap[color] || colorMap.primary)}>
        <Icon size={20} />
      </div>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h2>
    </div>
  );
}

// chartTooltipStyle moved to format-utils.ts to avoid fast-refresh warning
