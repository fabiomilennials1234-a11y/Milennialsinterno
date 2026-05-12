import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

import { TaskColumn } from './management-columns/TaskColumn';
import { DelaysColumn } from './management-columns/DelaysColumn';
import { JustificationsColumn } from './management-columns/JustificationsColumn';
import { DocDevColumn } from './management-columns/DocDevColumn';
import { DocProjectColumn } from './management-columns/DocProjectColumn';
import { OneOnOneColumn } from './management-columns/OneOnOneColumn';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function displayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return format(new Date(y, m - 1, d), "EEEE, dd 'de' MMMM", { locale: ptBR });
}

function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TechManagementBoard() {
  const [date, setDate] = useState(() => toDateStr(new Date()));

  const goBack = () => setDate((d) => toDateStr(subDays(new Date(d + 'T12:00:00'), 1)));
  const goForward = () => setDate((d) => toDateStr(addDays(new Date(d + 'T12:00:00'), 1)));
  const goToday = () => setDate(toDateStr(new Date()));

  return (
    <div className="-mx-8 flex flex-col h-[calc(100vh-14rem)]">
      {/* Date navigation — applies to Doc Dev + Doc Projeto */}
      <div className="px-8 pb-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="h-7 w-7 text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:bg-[var(--mtech-surface-elev)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 text-[var(--mtech-accent)]" />
          <span className="text-[11px] font-medium text-[var(--mtech-text)] capitalize">
            {displayDate(date)}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goForward}
          disabled={isToday(date)}
          className="h-7 w-7 text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:bg-[var(--mtech-surface-elev)] disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        {!isToday(date) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="h-6 px-2 text-[10px] text-[var(--mtech-accent)] hover:bg-[var(--mtech-accent-muted)]"
          >
            Hoje
          </Button>
        )}
      </div>

      {/* Columns — horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 pb-4">
        <div className="flex gap-3 h-full">
          <TaskColumn type="daily" />
          <TaskColumn type="weekly" />
          <TaskColumn type="step" />
          <DelaysColumn />
          <JustificationsColumn />
          <DocDevColumn date={date} />
          <DocProjectColumn date={date} />
          <OneOnOneColumn />
        </div>
      </div>
    </div>
  );
}
