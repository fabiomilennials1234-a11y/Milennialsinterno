import { useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useJustificativasTeam, type TeamItem } from '@/hooks/useJustificativas';
import PessoaAccordion from './PessoaAccordion';

export default function EquipeTab() {
  const [onlyPending, setOnlyPending] = useState(false);
  const { data, isLoading } = useJustificativasTeam(onlyPending);

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; role: string; items: TeamItem[] }>();
    (data ?? []).forEach((item) => {
      const cur = map.get(item.user_id) ?? { name: item.user_name, role: item.user_role, items: [] };
      cur.items.push(item);
      map.set(item.user_id, cur);
    });
    return [...map.entries()].map(([userId, v]) => ({ userId, ...v }));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{grouped.length} pessoas no seu escopo</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={onlyPending} onCheckedChange={setOnlyPending} />
          Só não-justificadas
        </label>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      )}

      {!isLoading && grouped.length === 0 && (
        <p className="text-center py-16 text-muted-foreground">Nenhuma pendência na sua equipe.</p>
      )}

      <ul className="space-y-3">
        {grouped.map((g) => (
          <li key={g.userId}>
            <PessoaAccordion userId={g.userId} userName={g.name} userRole={g.role} items={g.items} />
          </li>
        ))}
      </ul>
    </div>
  );
}
