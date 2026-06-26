import { useCallback, useState } from 'react';
import { CalendarRange, Columns3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useTechEpics,
  useEpicRollupMap,
  useSetEpicRoadmap,
  useUpdateEpicDates,
} from '../hooks/useTechEpics';
import { RoadmapTimeline } from '../components/RoadmapTimeline';
import { RoadmapNowNextLater } from '../components/RoadmapNowNextLater';

type RoadmapView = 'timeline' | 'buckets';

const VIEWS: { id: RoadmapView; label: string; icon: typeof CalendarRange }[] = [
  { id: 'timeline', label: 'Timeline', icon: CalendarRange },
  { id: 'buckets', label: 'Now / Next / Later', icon: Columns3 },
];

function RoadmapSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando roadmap"
      className="overflow-hidden rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)]"
      style={{ boxShadow: 'var(--mtech-shadow-card)' }}
    >
      <div className="flex items-center justify-between border-b border-[var(--mtech-border)] px-3 py-2.5">
        <div className="h-4 w-32 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
        <div className="h-7 w-24 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
      </div>
      <div className="border-b border-[var(--mtech-border)]" style={{ paddingLeft: 200 }}>
        <div className="flex h-7 items-center gap-12 px-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-2.5 w-8 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
          ))}
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center border-b border-[var(--mtech-border)]/60 last:border-0">
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ width: 200, minWidth: 200 }}>
            <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" />
            <div
              className="h-3.5 rounded bg-[var(--mtech-surface-elev)] animate-pulse"
              style={{ width: `${50 + ((i * 13) % 40)}%` }}
            />
          </div>
          <div className="relative h-9 flex-1">
            <div
              className="absolute top-1.5 h-6 rounded-[6px] bg-[var(--mtech-surface-elev)] animate-pulse"
              style={{ left: `${(i * 17) % 45}%`, width: `${28 + ((i * 11) % 34)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoadmapTab() {
  const [view, setView] = useState<RoadmapView>('timeline');

  const { data: epics = [], isLoading } = useTechEpics();
  const rollups = useEpicRollupMap();
  const setRoadmap = useSetEpicRoadmap();
  const updateDates = useUpdateEpicDates();

  const handleMove = useCallback(
    (input: { id: string; bucket: 'NOW' | 'NEXT' | 'LATER' | null; prevRank: string | null; nextRank: string | null }) => {
      setRoadmap.mutate(input, {
        onError: () => toast.error('Não foi possível mover o epic. Tente de novo.'),
      });
    },
    [setRoadmap],
  );

  const handleCommitDates = useCallback(
    (input: { id: string; startDate: string | null; deadline: string | null }) => {
      updateDates.mutate(input, {
        onError: () => toast.error('Não foi possível salvar as datas.'),
      });
    },
    [updateDates],
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--mtech-text)]">Roadmap</h2>
        <div className="flex items-center gap-1 rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mtech-accent)]/60',
                  view === v.id
                    ? 'bg-[var(--mtech-surface-elev)] text-[var(--mtech-text)] shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                    : 'text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <RoadmapSkeleton />
      ) : view === 'timeline' ? (
        <RoadmapTimeline epics={epics} rollups={rollups} onCommitDates={handleCommitDates} />
      ) : (
        <RoadmapNowNextLater epics={epics} rollups={rollups} onMove={handleMove} />
      )}
    </>
  );
}
