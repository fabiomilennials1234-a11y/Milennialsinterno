import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useTechProjects,
  useCreateTechProjectRpc,
  type TechProjectRow,
} from '../hooks/useTechProjects';
import { useTechProfiles } from '../hooks/useProfiles';
import { ProjectCreateModal } from '../components/ProjectCreateModal';
import {
  ProjectTracerList,
  type ProjectListItem,
} from '../components/ProjectTracerList';
import type {
  ProjectCreateValues,
  ProjectCreateType,
} from '../components/ProjectCreateForm';
import { validateKeyPrefix } from '../lib/projectKeyPrefix';
import {
  DUPLICATE_KEY_PREFIX_MESSAGE,
  isDuplicateKeyPrefixError,
  translateProjectCreateError,
} from '../lib/projectCreateError';

function toListItem(row: TechProjectRow): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix ?? '—',
    type: row.type === 'client' ? 'client' : 'internal',
    lead_name: row.lead_name,
  };
}

export function ProjectTracerTab() {
  const { data: projects = [], isLoading } = useTechProjects();
  const { data: profiles = [] } = useTechProfiles();
  const createProject = useCreateTechProjectRpc();

  const [modalOpen, setModalOpen] = useState(false);
  const [keyPrefixError, setKeyPrefixError] = useState<string | null>(null);

  const listItems = useMemo(() => projects.map(toListItem), [projects]);
  const existingPrefixes = useMemo(
    () => projects.map((p) => p.key_prefix).filter((k): k is string => !!k),
    [projects],
  );

  function openModal() {
    setKeyPrefixError(null);
    setModalOpen(true);
  }

  function handleSubmit(values: ProjectCreateValues) {
    // Mirror the server's unique constraint locally — skip the round-trip when
    // we already know the prefix collides with a loaded project.
    if (validateKeyPrefix(values.key_prefix, existingPrefixes) === 'duplicate') {
      setKeyPrefixError(DUPLICATE_KEY_PREFIX_MESSAGE);
      return;
    }

    createProject.mutate(
      {
        name: values.name,
        key_prefix: values.key_prefix,
        type: values.type as ProjectCreateType,
        description: values.description,
        priority: values.priority,
        lead_id: values.lead_id,
      },
      {
        onSuccess: () => {
          setKeyPrefixError(null);
          setModalOpen(false);
          toast.success('Projeto criado');
        },
        onError: (error: unknown) => {
          // Duplicate prefix is a field-level problem — surface it inline so the
          // user can fix the key without losing the rest of the form.
          if (isDuplicateKeyPrefixError(error)) {
            setKeyPrefixError(DUPLICATE_KEY_PREFIX_MESSAGE);
            return;
          }
          toast.error('Erro ao criar projeto', {
            description: translateProjectCreateError(error),
          });
        },
      },
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-[var(--mtech-text)]">Projetos</h2>
        <Button
          size="sm"
          onClick={openModal}
          className="gap-1.5 bg-[var(--mtech-accent)] font-semibold text-black hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Novo projeto
        </Button>
      </div>

      <ProjectTracerList
        projects={listItems}
        isLoading={isLoading}
        onCreateClick={openModal}
      />

      <ProjectCreateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        profiles={profiles}
        onSubmit={handleSubmit}
        isSubmitting={createProject.isPending}
        keyPrefixError={keyPrefixError}
        onKeyPrefixChange={() => setKeyPrefixError(null)}
      />
    </>
  );
}
