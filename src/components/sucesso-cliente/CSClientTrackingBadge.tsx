import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CSClientTracking, DAY_LABELS, isTrackingDelayed } from '@/hooks/useCSOnboardingTracking';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CSClientTrackingBadgeProps {
  tracking: CSClientTracking | null | undefined;
  compact?: boolean;
}

const DAYS_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

const DAY_FULL_LABELS: Record<string, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
};

export default function CSClientTrackingBadge({ tracking, compact = false }: CSClientTrackingBadgeProps) {
  if (!tracking) {
    return null;
  }

  const isDelayed = isTrackingDelayed(tracking.last_moved_at);
  const dayIndex = DAYS_ORDER.indexOf(tracking.current_day);
  
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`gap-1 ${isDelayed ? 'bg-warning/10 text-warning border-warning/30' : 'bg-accent text-accent-foreground border-accent'}`}
            >
              <Calendar className="h-3 w-3" />
              <span className="font-medium">{DAY_LABELS[tracking.current_day]}</span>
              {isDelayed && <AlertTriangle className="h-3 w-3" />}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              <p className="font-medium">Acompanhamento Diário</p>
              <p className="text-sm">Dia atual: <span className="font-medium">{DAY_FULL_LABELS[tracking.current_day]}</span></p>
              {/* Day progress visual */}
              <div className="flex gap-1 py-1">
                {DAYS_ORDER.map((day, index) => {
                  const isCurrent = day === tracking.current_day;
                  const isPast = index < dayIndex;
                  
                  return (
                    <div key={day} className="flex flex-col items-center gap-0.5">
                      <div
                        className={`w-6 h-1.5 rounded-full transition-colors ${
                          isCurrent 
                            ? (isDelayed ? 'bg-warning' : 'bg-primary')
                            : isPast 
                              ? 'bg-success' 
                              : 'bg-muted'
                        }`}
                      />
                      <span className={`text-[9px] ${isCurrent ? 'font-bold' : ''}`}>{DAY_LABELS[day]}</span>
                    </div>
                  );
                })}
              </div>
              {tracking.last_moved_at && (
                <p className="text-xs text-muted-foreground">
                  Última movimentação: {formatDistanceToNow(new Date(tracking.last_moved_at), { addSuffix: true, locale: ptBR })}
                </p>
              )}
              {isDelayed && (
                <p className="text-xs text-warning font-medium">⚠️ Aguardando movimentação de hoje</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`rounded-lg p-2.5 space-y-2 border ${isDelayed ? 'bg-warning/5 border-warning/20' : 'bg-accent/30 border-accent'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className={`h-3.5 w-3.5 ${isDelayed ? 'text-warning' : 'text-accent-foreground'}`} />
          <span className={`text-xs font-semibold ${isDelayed ? 'text-warning' : 'text-accent-foreground'}`}>ACOMPANHAMENTO</span>
        </div>
        {isDelayed && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] h-5">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            Atrasado
          </Badge>
        )}
      </div>
      
      {/* Day progress indicators with labels */}
      <div className="flex gap-1">
        {DAYS_ORDER.map((day, index) => {
          const isCurrent = day === tracking.current_day;
          const isPast = index < dayIndex;
          
          return (
            <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={`w-full h-2 rounded-full transition-colors ${
                  isCurrent 
                    ? (isDelayed ? 'bg-warning' : 'bg-primary')
                    : isPast 
                      ? 'bg-success' 
                      : 'bg-muted'
                }`}
              />
              <span className={`text-[9px] ${isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                {DAY_LABELS[day]}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Current day highlighted */}
      <div className={`rounded px-2 py-1.5 ${isDelayed ? 'bg-warning/10' : 'bg-primary/10'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${isDelayed ? 'text-warning' : 'text-primary'}`}>
            {DAY_FULL_LABELS[tracking.current_day]}
          </span>
          {tracking.last_moved_at && (
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(tracking.last_moved_at), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
