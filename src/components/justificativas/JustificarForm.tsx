import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSubmitJustificativa } from '@/hooks/useJustificativas';

interface Props {
  notificationId: string;
  onSubmitted?: () => void;
}

export default function JustificarForm({ notificationId, onSubmitted }: Props) {
  const [text, setText] = useState('');
  const { mutateAsync, isPending } = useSubmitJustificativa();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await mutateAsync({ notificationId, text });
    setText('');
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Explique o motivo do atraso..."
        className="min-h-[96px] resize-none"
        maxLength={500}
        autoFocus
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{text.length}/500</span>
        <Button
          type="submit"
          disabled={!text.trim() || isPending}
          className="bg-danger hover:bg-danger/90 text-white"
        >
          {isPending ? 'Enviando...' : 'Enviar Justificativa'}
        </Button>
      </div>
    </form>
  );
}
