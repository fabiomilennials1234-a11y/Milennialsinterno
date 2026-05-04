import { useState } from 'react';
import { useJustificativasPendentes } from '@/hooks/useJustificativas';
import JustificativaItem from './JustificativaItem';
import JustificarForm from './JustificarForm';
import { Loader2 } from 'lucide-react';

export default function PendentesTab() {
  const { data, isLoading } = useJustificativasPendentes();
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Sem pendências por enquanto.</p>
        <p className="text-sm">Continue assim.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.notification_id}>
          <JustificativaItem
            title={item.task_title}
            dueDate={item.task_due_date}
            state={item.requires_revision ? 'revision' : 'pending'}
            masterComment={item.master_comment}
          >
            {openId === item.notification_id ? (
              <JustificarForm
                notificationId={item.notification_id}
                onSubmitted={() => setOpenId(null)}
              />
            ) : (
              <button
                onClick={() => setOpenId(item.notification_id)}
                className="text-sm text-danger hover:underline"
              >
                Justificar
              </button>
            )}
          </JustificativaItem>
        </li>
      ))}
    </ul>
  );
}
