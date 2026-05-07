import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PenTool,
  Settings,
  Code,
  GitPullRequest,
  TestTube,
  Rocket,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import type { TechProjectRow } from '../hooks/useTechProjects';
import { useUpdateTechProject } from '../hooks/useTechProjects';
import { PROJECT_STEPS, PROJECT_STEP_LABEL, type ProjectStep } from '../lib/projectSteps';
import { ProjectKanbanColumn } from './ProjectKanbanColumn';
import { ProjectDetailModal } from './ProjectDetailModal';

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

interface ColumnDef {
  step: ProjectStep;
  label: string;
  icon: LucideIcon;
  color: string;
}

const COLUMN_DEFS: ColumnDef[] = [
  { step: 'briefing', label: 'Briefing Tecnico', icon: ClipboardList, color: '#38BDF8' },
  { step: 'arquitetura', label: 'Arquitetura', icon: PenTool, color: '#8B5CF6' },
  { step: 'setup_ambiente', label: 'Setup Ambiente', icon: Settings, color: '#F59E0B' },
  { step: 'desenvolvimento', label: 'Desenvolvimento', icon: Code, color: '#3B82F6' },
  { step: 'code_review', label: 'Code Review', icon: GitPullRequest, color: '#F97316' },
  { step: 'testes', label: 'Testes / QA', icon: TestTube, color: '#10B981' },
  { step: 'deploy', label: 'Deploy', icon: Rocket, color: '#A855F7' },
  { step: 'acompanhamento', label: 'Acompanhamento', icon: Eye, color: '#22C55E' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProjectsKanbanViewProps {
  projects: TechProjectRow[];
  isLoading: boolean;
}

export function ProjectsKanbanView({ projects, isLoading }: ProjectsKanbanViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [editingProject, setEditingProject] = useState<TechProjectRow | null>(null);
  const updateProject = useUpdateTechProject();

  // Group projects by current_step
  const projectsByStep = useMemo(() => {
    const map: Record<string, TechProjectRow[]> = {};
    for (const step of PROJECT_STEPS) {
      map[step] = [];
    }
    for (const p of projects) {
      const step = p.current_step;
      if (map[step]) {
        map[step].push(p);
      } else {
        // Fallback: unknown step goes to briefing
        map[PROJECT_STEPS[0]].push(p);
      }
    }
    return map;
  }, [projects]);

  // Scroll detection
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    checkScroll();
    // Recheck on resize
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -400 : 400,
      behavior: 'smooth',
    });
  };

  // Drag-and-drop: move project to new step
  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (destination.droppableId === source.droppableId) return;

      const newStep = destination.droppableId;
      // Validate step exists
      if (!(PROJECT_STEPS as readonly string[]).includes(newStep)) return;

      updateProject.mutate({
        id: draggableId,
        patch: { current_step: newStep },
      });
    },
    [updateProject],
  );

  const handleOpenProject = useCallback(
    (id: string) => {
      const proj = projects.find((p) => p.id === id);
      if (proj) setEditingProject(proj);
    },
    [projects],
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0" style={{ width: 370 }}>
            <div className="h-4 w-24 rounded bg-[var(--mtech-surface-elev)] animate-pulse mb-4" />
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 2 - (i % 2) }).map((_, j) => (
                <div
                  key={j}
                  className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-3.5 space-y-2.5"
                  style={{ width: 340 }}
                >
                  <div className="h-3.5 w-3/4 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
                  <div className="h-1 w-full rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        {/* Chevron left */}
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[var(--mtech-surface)] border border-[var(--mtech-border)] hover:bg-[var(--mtech-surface-elev)] shadow-lg"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4 text-[var(--mtech-text-muted)]" />
          </Button>
        )}

        {/* Chevron right */}
        {canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[var(--mtech-surface)] border border-[var(--mtech-border)] hover:bg-[var(--mtech-surface-elev)] shadow-lg"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4 text-[var(--mtech-text-muted)]" />
          </Button>
        )}

        {/* Scrollable kanban */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div
            ref={scrollRef}
            className="overflow-x-auto overflow-y-hidden pb-4 scrollbar-apple"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="flex gap-5" style={{ minWidth: 'max-content', paddingLeft: 4, paddingRight: 4 }}>
              {COLUMN_DEFS.map((col) => (
                <ProjectKanbanColumn
                  key={col.step}
                  step={col.step}
                  label={col.label}
                  icon={col.icon}
                  accentColor={col.color}
                  projects={projectsByStep[col.step] ?? []}
                  onOpenProject={handleOpenProject}
                />
              ))}
            </div>
          </div>
        </DragDropContext>
      </div>

      {/* Detail modal (drill-down) */}
      {editingProject && (
        <ProjectDetailModal
          open={!!editingProject}
          onOpenChange={(open) => {
            if (!open) setEditingProject(null);
          }}
          project={editingProject}
        />
      )}
    </>
  );
}
