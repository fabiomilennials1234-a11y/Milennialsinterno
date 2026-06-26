import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ProjectCreateForm,
  type ProjectCreateFormProps,
} from './ProjectCreateForm';

// ---------------------------------------------------------------------------
// Props — thin Dialog shell over ProjectCreateForm.
// All form behaviour (validation, key preview, submit) lives in the form.
// ---------------------------------------------------------------------------

export interface ProjectCreateModalProps
  extends Omit<ProjectCreateFormProps, 'showCancel' | 'onCancel' | 'formId'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectCreateModal({ open, onOpenChange, ...formProps }: ProjectCreateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mtech-scope max-w-lg max-h-[90vh] overflow-y-auto border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text)]"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-[var(--mtech-text)]">
            Novo projeto
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--mtech-text-subtle)]">
            Defina o nome e a chave. A chave prefixa toda task do projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <ProjectCreateForm
            {...formProps}
            showCancel
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
