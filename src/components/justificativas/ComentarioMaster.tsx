import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useRequestRevision, useArchiveJustification } from '@/hooks/useJustificativas';

interface Props {
  justificationId: string;
  archived: boolean;
  initialComment?: string | null;
}

export default function ComentarioMaster({ justificationId, archived, initialComment }: Props) {
  const [text, setText] = useState(initialComment ?? '');
  const [requireRevision, setRequireRevision] = useState(false);
  const revisionMut = useRequestRevision();
  const archiveMut = useArchiveJustification();

  const handleSave = async () => {
    if (!text.trim() || !requireRevision) return;
    await revisionMut.mutateAsync({ justificationId, comment: text });
  };

  return (
    <div className="space-y-2 mt-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Comentário (opcional)"
        className="min-h-[72px] resize-none"
        maxLength={500}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id={`req-${justificationId}`}
          checked={requireRevision}
          onCheckedChange={(v) => setRequireRevision(v === true)}
        />
        <label htmlFor={`req-${justificationId}`} className="text-sm cursor-pointer">
          Exigir refazer
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => archiveMut.mutate({ id: justificationId, archive: !archived })}
        >
          {archived ? 'Restaurar' : 'Arquivar'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!text.trim() || !requireRevision || revisionMut.isPending}
        >
          Solicitar revisão
        </Button>
      </div>
    </div>
  );
}
