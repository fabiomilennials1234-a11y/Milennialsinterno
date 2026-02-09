import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isTrackingDelayed, DAY_LABELS } from '@/hooks/useCSOnboardingTracking';

interface CSComercialTrackingBadgeProps {
  currentDay: string;
  lastMovedAt: string | null;
  managerName?: string;
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

export default function CSComercialTrackingBadge({ 
  currentDay, 
  lastMovedAt,
  managerName,
  compact = false 
}: CSComercialTrackingBadgeProps) {
  const isDelayed = isTrackingDelayed(lastMovedAt);
  const dayIndex = DAYS_ORDER.indexOf(currentDay);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`gap-1 ${isDelayed 
              ? 'bg-warning/10 text-warning border-warning/30' 
              : 'bg-accent text-accent-foreground border-accent'
            } text-[10px]`}
          >
            <Calendar className="h-2.5 w-2.5" />
            <span className="font-medium">{DAY_LABELS[currentDay] || currentDay}</span>
            {isDelayed && <AlertTriangle className="h-2.5 w-2.5" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2">
            <p className="font-medium">Acompanhamento Comercial</p>
            {managerName && (
              <p className="text-xs">Gestor: <span className="font-medium">{managerName}</span></p>
            )}
            <p className="text-sm">Dia: <span className="font-medium">{DAY_FULL_LABELS[currentDay]}</span></p>
            
            {/* Day progress visual */}
            <div className="flex gap-1 py-1">
              {DAYS_ORDER.map((day, index) => {
                const isCurrent = day === currentDay;
                const isPast = index < dayIndex;
                
                return (
                  <div key={day} className="flex flex-col items-center gap-0.5">
                    <div
                      className={`w-5 h-1.5 rounded-full transition-colors ${
                        isCurrent 
                          ? (isDelayed ? 'bg-warning' : 'bg-primary')
                          : isPast 
                            ? 'bg-success' 
                            : 'bg-muted'
                      }`}
                    />
                    <span className={`text-[8px] ${isCurrent ? 'font-bold' : ''}`}>
                      {DAY_LABELS[day]}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {lastMovedAt && (
              <p className="text-xs text-muted-foreground">
                Última movimentação: {formatDistanceToNow(new Date(lastMovedAt), { addSuffix: true, locale: ptBR })}
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
