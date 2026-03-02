import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OutboundFunnelCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  children: React.ReactNode;
  color: string;
}

export default function OutboundFunnelCard({ title, description, icon, enabled, setEnabled, children, color }: OutboundFunnelCardProps) {
  const [isExpanded, setIsExpanded] = useState(enabled);

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      enabled ? 'border-primary bg-primary/5' : 'border-border bg-card'
    )}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">{title}</h4>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => {
                  setEnabled(checked);
                  if (checked) setIsExpanded(true);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </div>

      {isExpanded && enabled && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
