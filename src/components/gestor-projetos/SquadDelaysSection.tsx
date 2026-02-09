import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DelayItem {
  id: string;
  type: string;
  title: string;
  assignee: string;
  dueDate: string;
  department: string;
}

export default function SquadDelaysSection() {
  const { data: delays = [], isLoading } = useQuery({
    queryKey: ['squad-delays'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const items: DelayItem[] = [];

      // Ads tasks atrasadas
      const { data: adsTasks } = await supabase
        .from('ads_tasks')
        .select('id, title, due_date')
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false);

      if (adsTasks) {
        for (const task of adsTasks) {
          items.push({
            id: task.id,
            type: 'ads_task',
            title: task.title,
            assignee: 'Gestor Ads',
            dueDate: task.due_date || today,
            department: 'Ads',
          });
        }
      }

      // Comercial tasks atrasadas
      const { data: comercialTasks } = await supabase
        .from('comercial_tasks')
        .select('id, title, due_date')
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false);

      if (comercialTasks) {
        for (const task of comercialTasks) {
          items.push({
            id: task.id,
            type: 'comercial_task',
            title: task.title,
            assignee: 'Comercial',
            dueDate: task.due_date || today,
            department: 'Comercial',
          });
        }
      }

      // Ordenar por data mais antiga primeiro
      return items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (delays.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 text-success opacity-70" size={32} />
        <p className="font-medium text-sm">Nenhum atraso!</p>
        <p className="text-xs mt-1">Tudo em dia 🎉</p>
      </div>
    );
  }

  const getDepartmentColor = (dept: string) => {
    switch (dept) {
      case 'Ads': return 'bg-info/10 text-info';
      case 'Comercial': return 'bg-success/10 text-success';
      case 'Design': return 'bg-purple/10 text-purple';
      case 'Vídeo': return 'bg-warning/10 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        {delays.map(delay => (
          <div
            key={`${delay.type}-${delay.id}`}
            className="p-3 rounded-lg bg-danger/5 border border-danger/20 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {delay.title}
              </p>
              <Badge variant="outline" className={`shrink-0 text-xs ${getDepartmentColor(delay.department)}`}>
                {delay.department}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{delay.assignee}</span>
              <span className="text-danger font-medium">
                {format(new Date(delay.dueDate), "dd MMM", { locale: ptBR })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
