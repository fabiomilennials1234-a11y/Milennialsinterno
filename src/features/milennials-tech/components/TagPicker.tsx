import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { isExecutive } from '@/types/auth';
import {
  useTechTags,
  useTechTaskTags,
  useCreateTechTag,
  useAddTaskTag,
  useRemoveTaskTag,
  type TechTag,
} from '../hooks/useTechTags';

const TAG_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F97316', // orange
  '#22C55E', // green
  '#EAB308', // yellow
  '#06B6D4', // cyan
  '#E5484D', // red
];

interface TagPickerProps {
  taskId: string;
}

export function TagPicker({ taskId }: TagPickerProps) {
  const { user } = useAuth();
  const { data: allTags = [] } = useTechTags();
  const { data: taskTags = [] } = useTechTaskTags(taskId);
  const createTag = useCreateTechTag();
  const addTaskTag = useAddTaskTag();
  const removeTaskTag = useRemoveTaskTag();

  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const isExec = isExecutive(user?.role);
  const assignedTagIds = new Set(taskTags.map((tt) => tt.tag_id));

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !user?.id) return;
    try {
      const tag = await createTag.mutateAsync({
        name: newTagName.trim(),
        color: newTagColor,
        created_by: user.id,
      });
      // Auto-assign to current task
      await addTaskTag.mutateAsync({ taskId, tagId: tag.id });
      toast.success(`Tag "${tag.name}" criada`);
      setNewTagName('');
      setShowCreate(false);
    } catch {
      toast.error('Erro ao criar tag (nome duplicado?)');
    }
  };

  const handleToggleTag = async (tag: TechTag) => {
    if (assignedTagIds.has(tag.id)) {
      await removeTaskTag.mutateAsync({ taskId, tagId: tag.id });
    } else {
      await addTaskTag.mutateAsync({ taskId, tagId: tag.id });
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide">
        Tags
      </h3>

      {/* Assigned tags */}
      <div className="flex flex-wrap gap-1.5">
        {allTags
          .filter((t) => assignedTagIds.has(t.id))
          .map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold select-none"
              style={{ color: tag.color, backgroundColor: `${tag.color}1A` }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTaskTag.mutate({ taskId, tagId: tag.id })}
                className="hover:opacity-70 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
      </div>

      {/* Available tags to add */}
      {allTags.filter((t) => !assignedTagIds.has(t.id)).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags
            .filter((t) => !assignedTagIds.has(t.id))
            .map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleToggleTag(tag)}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-[var(--mtech-border)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-border-strong)] transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
        </div>
      )}

      {/* Create new tag (exec only) */}
      {isExec && (
        <>
          {showCreate ? (
            <div className="flex items-center gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome da tag..."
                className="h-7 text-xs flex-1 bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTag();
                  if (e.key === 'Escape') setShowCreate(false);
                }}
                autoFocus
              />
              <div className="flex gap-0.5">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className="w-4 h-4 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      transform: newTagColor === c ? 'scale(1.3)' : 'scale(1)',
                      outline: newTagColor === c ? '2px solid var(--mtech-text)' : 'none',
                      outlineOffset: 1,
                    }}
                  />
                ))}
              </div>
              <Button
                size="sm"
                onClick={handleCreateTag}
                disabled={createTag.isPending || !newTagName.trim()}
                className="bg-[var(--mtech-accent)] text-black h-7 px-2 text-xs font-semibold"
              >
                Criar
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-accent)] transition-colors"
            >
              <Plus className="h-3 w-3" />
              Criar tag
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Compact tag display for cards and rows (read-only) */
export function TaskTagBadges({ taskId, allTags, taskTags }: {
  taskId: string;
  allTags: TechTag[];
  taskTags: { task_id: string; tag_id: string }[];
}) {
  const myTags = taskTags.filter((tt) => tt.task_id === taskId);
  if (myTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {myTags.map((tt) => {
        const tag = allTags.find((t) => t.id === tt.tag_id);
        if (!tag) return null;
        return (
          <span
            key={tag.id}
            className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider select-none"
            style={{ color: tag.color, backgroundColor: `${tag.color}1A` }}
          >
            {tag.name}
          </span>
        );
      })}
    </div>
  );
}
