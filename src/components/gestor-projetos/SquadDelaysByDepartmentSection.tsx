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
  responsibleName: string;
}

export default function SquadDelaysByDepartmentSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['squad-delays-by-department'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      // Fetch all base data in parallel
      const [comercialRes, adsRes, profilesRes, designBoardRes, videoBoardRes] = await Promise.all([
        supabase
          .from('comercial_tasks')
          .select('id, title, due_date, user_id, related_client_id')
          .lt('due_date', today)
          .neq('status', 'done')
          .eq('archived', false)
          .order('due_date', { ascending: true }),
        supabase
          .from('ads_tasks')
          .select('id, title, due_date, ads_manager_id')
          .lt('due_date', today)
          .neq('status', 'done')
          .eq('archived', false)
          .order('due_date', { ascending: true }),
        supabase
          .from('profiles')
          .select('user_id, name'),
        supabase
          .from('kanban_boards')
          .select('id')
          .ilike('slug', '%design%')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('kanban_boards')
          .select('id')
          .ilike('slug', '%video%')
          .limit(1)
          .maybeSingle(),
      ]);

      // Build name lookup map
      const nameMap: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => {
        nameMap[p.user_id] = p.name;
      });

      // --- COMERCIAL: resolve responsible via clients.assigned_comercial ---
      const comercialTasks = comercialRes.data || [];
      const clientIds = comercialTasks
        .map(t => t.related_client_id)
        .filter((id): id is string => !!id);

      const clientToComercial: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, assigned_comercial')
          .in('id', clientIds);
        (clientsData || []).forEach(c => {
          if (c.assigned_comercial) {
            clientToComercial[c.id] = c.assigned_comercial;
          }
        });
      }

      const comercial: DelayItem[] = comercialTasks.map(t => {
        const actualUserId = (t.related_client_id && clientToComercial[t.related_client_id])
          ? clientToComercial[t.related_client_id]
          : t.user_id;
        return {
          id: t.id,
          title: t.title,
          dueDate: t.due_date || today,
          department: 'Comercial',
          responsibleName: nameMap[actualUserId] || 'Responsável não definido',
        };
      });

      // --- ADS ---
      const ads: DelayItem[] = (adsRes.data || []).map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date || today,
        department: 'Ads',
        responsibleName: nameMap[t.ads_manager_id] || 'Responsável não definido',
      }));

      // --- DESIGN & VIDEO: fetch overdue kanban_cards with column info ---
      const fetchKanbanDelays = async (boardId: string | null, department: string): Promise<DelayItem[]> => {
        if (!boardId) return [];

        // Fetch overdue cards and board columns in parallel
        const [cardsRes, columnsRes] = await Promise.all([
          supabase
            .from('kanban_cards')
            .select('id, title, due_date, assigned_to, column_id')
            .eq('board_id', boardId)
            .lt('due_date', today)
            .neq('status', 'done')
            .eq('archived', false)
            .order('due_date', { ascending: true }),
          supabase
            .from('kanban_columns')
            .select('id, title')
            .eq('board_id', boardId),
        ]);

        // Build column title map (column_id → column title)
        const columnTitleMap: Record<string, string> = {};
        (columnsRes.data || []).forEach(col => {
          columnTitleMap[col.id] = col.title;
        });

        // Extract responsible name from column title pattern "BY [NAME]"
        const getResponsibleFromColumn = (columnId: string): string => {
          const title = columnTitleMap[columnId] || '';
          const match = title.match(/^BY\s+(.+)/i);
          if (match) {
            // Capitalize properly: "FRANK" → "Frank"
            const raw = match[1].trim();
            return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
          }
          return '';
        };

        return (cardsRes.data || []).map(c => {
          // Priority: 1) assigned_to profile name, 2) column title "BY X", 3) fallback
          const assignedName = c.assigned_to ? nameMap[c.assigned_to] : '';
          const columnName = getResponsibleFromColumn(c.column_id);
          return {
            id: c.id,
            title: c.title,
            dueDate: c.due_date || today,
            department,
            responsibleName: assignedName || columnName || 'Responsável não definido',
          };
        });
      };

      const [design, video] = await Promise.all([
        fetchKanbanDelays(designBoardRes.data?.id || null, 'Design'),
        fetchKanbanDelays(videoBoardRes.data?.id || null, 'Vídeo'),
      ]);

      return {
        comercial,
        ads,
        design,
        video,
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

  const totalDelays = (data?.comercial.length || 0) + (data?.ads.length || 0) + (data?.design.length || 0) + (data?.video.length || 0);

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
            <p className="text-xs text-muted-foreground mb-1">
              {item.responsibleName}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-danger font-medium">
                {format(new Date(item.dueDate), "dd MMM", { locale: ptBR })}
              </p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-danger/40 text-danger">
                {item.department}
              </Badge>
            </div>
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
          {(data?.design.length || 0) > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
              {data?.design.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="video" className="text-xs relative">
          VID
          {(data?.video.length || 0) > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
              {data?.video.length}
            </Badge>
          )}
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
            {renderDelayList(data?.design || [])}
          </TabsContent>
          <TabsContent value="video" className="mt-0 pr-2">
            {renderDelayList(data?.video || [])}
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}
