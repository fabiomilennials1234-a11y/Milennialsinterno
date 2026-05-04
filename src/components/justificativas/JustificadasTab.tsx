import { useJustificativasDoneMine } from '@/hooks/useJustificativas';
import JustificativaItem from './JustificativaItem';
import { Loader2 } from 'lucide-react';

export default function JustificadasTab() {
  const { data, isLoading } = useJustificativasDoneMine();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  if (!data || data.length === 0) {
    return <p className="text-center py-16 text-muted-foreground">Você ainda não justificou nada.</p>;
  }

  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.justification_id}>
          <JustificativaItem
            title={item.task_title}
            dueDate={item.task_due_date}
            state="done"
            justificationText={item.justification}
          />
        </li>
      ))}
    </ul>
  );
}
