import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Star, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';

export type ClientLabel = 'otimo' | 'bom' | 'medio' | 'ruim' | null;

interface ClientLabelBadgeProps {
  label: ClientLabel;
  size?: 'sm' | 'md';
  className?: string;
}

const LABEL_CONFIG: Record<Exclude<ClientLabel, null>, {
  text: string;
  icon: React.ElementType;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  otimo: {
    text: 'Ótimo',
    icon: Star,
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    borderColor: 'border-success/30',
  },
  bom: {
    text: 'Bom',
    icon: ThumbsUp,
    bgColor: 'bg-info/10',
    textColor: 'text-info',
    borderColor: 'border-info/30',
  },
  medio: {
    text: 'Médio',
    icon: Minus,
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/30',
  },
  ruim: {
    text: 'Ruim',
    icon: ThumbsDown,
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/30',
  },
};

export default function ClientLabelBadge({ label, size = 'sm', className }: ClientLabelBadgeProps) {
  if (!label) return null;

  const config = LABEL_CONFIG[label];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        config.bgColor,
        config.textColor,
        config.borderColor,
        size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-sm px-2 py-0.5',
        className
      )}
    >
      <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {config.text}
    </Badge>
  );
}

export { LABEL_CONFIG };
