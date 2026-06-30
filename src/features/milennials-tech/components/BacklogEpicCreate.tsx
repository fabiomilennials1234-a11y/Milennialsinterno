import { useState } from 'react';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCreateEpic } from '../hooks/useTechEpics';
import { EpicFormModal, type EpicCreatePayload } from './EpicFormModal';

// ---------------------------------------------------------------------------
// BacklogEpicCreate (#172) — "Nova Epic" from the backlog. An epic always lands
// under one project, so the action is enabled only when the backlog has a
// *current project* (deep-link or single-project filter); otherwise the button
// is inert with a hint. Reuses EpicFormModal + useCreateEpic verbatim — the
// create invalidates the epic list, so useTechEpics refreshes with no reload.
//
// Demand linking stays out of scope (ADR 0015): tech_epic_create doesn't persist
// demandaId yet, so the modal runs in `internal` scope (no dead demand control).
// ---------------------------------------------------------------------------

export interface BacklogEpicCreateProps {
  /** The backlog's current project, or null when none is in scope. */
  projectId: string | null;
  /** Human label for the modal header. */
  projectLabel: string | null;
}

export function BacklogEpicCreate({ projectId, projectLabel }: BacklogEpicCreateProps) {
  const [open, setOpen] = useState(false);
  const createEpic = useCreateEpic();

  function handleSubmit(payload: EpicCreatePayload) {
    if (!projectId) return;
    createEpic.mutate(
      {
        projectId,
        title: payload.title,
        description: payload.description,
        startDate: payload.startDate,
        deadline: payload.deadline,
      },
      {
        onSuccess: () => {
          toast.success('Epic criada.');
          setOpen(false);
        },
        onError: () => toast.error('Não foi possível criar a epic.'),
      },
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={!projectId}
        onClick={() => setOpen(true)}
        title={projectId ? undefined : 'Filtre por um projeto para criar uma epic'}
        className="border-[var(--mtech-border)] text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:border-[var(--mtech-border-strong)] gap-1.5 disabled:opacity-50"
      >
        <Layers className="h-3.5 w-3.5" />
        Nova Epic
      </Button>

      <EpicFormModal
        open={open}
        onOpenChange={setOpen}
        projectLabel={projectLabel}
        demandaScope="internal"
        demandas={[]}
        onSubmit={handleSubmit}
        isSubmitting={createEpic.isPending}
      />
    </>
  );
}
