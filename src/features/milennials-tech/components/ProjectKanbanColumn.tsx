import { Droppable, Draggable } from '@hello-pangea/dnd';
import { AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { TechProjectRow } from '../hooks/useTechProjects';
import { ProjectCard } from './ProjectCard';

interface ProjectKanbanColumnProps {
  step: string;
  label: string;
  icon: LucideIcon;
  accentColor: string;
  projects: TechProjectRow[];
  onOpenProject: (id: string) => void;
}

export function ProjectKanbanColumn({
  step,
  label,
  icon: Icon,
  accentColor,
  projects,
  onOpenProject,
}: ProjectKanbanColumnProps) {
  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: 370 }}>
      {/* Column header */}
      <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-[var(--mtech-border)]">
        <span
          className="flex items-center justify-center h-6 w-6 rounded-md"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accentColor }} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mtech-text-muted)]">
          {label}
        </span>
        <span
          className="ml-auto text-[11px] text-[var(--mtech-text-subtle)] tabular-nums"
          data-mono
        >
          {projects.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={step}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-col gap-2.5 flex-1 rounded-[var(--mtech-radius-md)] p-1 transition-colors"
            style={{
              minHeight: 140,
              background: snapshot.isDraggingOver
                ? `${accentColor}10`
                : 'transparent',
            }}
          >
            <AnimatePresence initial={false}>
              {projects.map((project, index) => (
                <Draggable key={project.id} draggableId={project.id} index={index}>
                  {(dragProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                    >
                      <ProjectCard
                        project={project}
                        onClick={() => onOpenProject(project.id)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
            </AnimatePresence>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
