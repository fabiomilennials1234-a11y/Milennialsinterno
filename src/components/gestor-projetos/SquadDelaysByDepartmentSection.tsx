import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DelayItem {
  id: string;
  title: string;
  dueDate: string;
  department: string;
}

export default function SquadDelaysByDepartmentSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['squad-delays-by-department'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      // Comercial delays
      const { data: comercialTasks } = await supabase
        .from('comercial_tasks')
        .select('id, title, due_date')
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false)
        .order('due_date', { ascending: true });

      // Ads delays
      const { data: adsTasks } = await supabase
        .from('ads_tasks')
        .select('id, title, due_date')
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false)
        .order('due_date', { ascending: true });

      const comercial: DelayItem[] = (comercialTasks || []).map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date || today,
        department: 'Comercial',
      }));

      const ads: DelayItem[] = (adsTasks || []).map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date || today,
        department: 'Ads',
      }));

      return {
        comercial,
        ads,
        design: [] as DelayItem[],
        video: [] as DelayItem[],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalDelays = (data?.comercial.length || 0) + (data?.ads.length || 0);

  if (totalDelays === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 text-success opacity-70" size={32} />
        <p className="font-medium text-sm">Nenhum atraso!</p>
        <p className="text-xs mt-1">Tudo em dia 🎉</p>
      </div>
    );
  }

  const renderDelayList = (items: DelayItem[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Nenhum atraso
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.id}
            className="p-3 rounded-lg bg-danger/5 border border-danger/20"
          >
            <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">
              {item.title}
            </p>
            <p className="text-xs text-danger font-medium">
              {format(new Date(item.dueDate), "dd MMM", { locale: ptBR })}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Tabs defaultValue="comercial" className="h-full flex flex-col">
      <TabsList className="grid grid-cols-4 mb-3 shrink-0">
        <TabsTrigger value="comercial" className="text-xs relative">
          COM
          {(data?.comercial.length || 0) > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
              {data?.comercial.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="ads" className="text-xs relative">
          ADS
          {(data?.ads.length || 0) > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
              {data?.ads.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="design" className="text-xs relative">
          DES
        </TabsTrigger>
        <TabsTrigger value="video" className="text-xs relative">
          VID
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <TabsContent value="comercial" className="mt-0 pr-2">
            {renderDelayList(data?.comercial || [])}
          </TabsContent>
          <TabsContent value="ads" className="mt-0 pr-2">
            {renderDelayList(data?.ads || [])}
          </TabsContent>
          <TabsContent value="design" className="mt-0 pr-2">
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum atraso
            </div>
          </TabsContent>
          <TabsContent value="video" className="mt-0 pr-2">
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhum atraso
            </div>
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}
