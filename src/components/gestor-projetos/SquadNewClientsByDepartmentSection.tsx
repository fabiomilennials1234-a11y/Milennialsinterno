import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NewClient {
  id: string;
  name: string;
  created_at: string;
  status: string | null;
  hasAds: boolean;
  hasComercial: boolean;
}

export default function SquadNewClientsByDepartmentSection() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['squad-new-clients-by-dept'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, created_at, status, assigned_ads_manager, assigned_comercial')
        .eq('archived', false)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        status: c.status,
        hasAds: !!c.assigned_ads_manager,
        hasComercial: !!c.assigned_comercial,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const adsClients = clients.filter(c => c.hasAds);
  const comercialClients = clients.filter(c => c.hasComercial);
  const unassigned = clients.filter(c => !c.hasAds && !c.hasComercial);

  const renderClientList = (clientList: NewClient[], emptyMessage: string) => {
    if (clientList.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <UserPlus className="mx-auto mb-2 opacity-50" size={24} />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {clientList.map(client => (
          <div
            key={client.id}
            className="p-3 rounded-lg bg-muted/50 border border-subtle"
          >
            <p className="text-sm font-medium text-foreground mb-1">
              {client.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(client.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        ))}
      </div>
    );
  };

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserPlus className="mx-auto mb-2 opacity-50" size={32} />
        <p className="font-medium text-sm">Nenhum cliente novo</p>
        <p className="text-xs mt-1">Últimos 7 dias</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="all" className="h-full flex flex-col">
      <TabsList className="grid grid-cols-4 mb-3 shrink-0">
        <TabsTrigger value="all" className="text-xs">
          Todos
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
            {clients.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="comercial" className="text-xs">
          COM
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1 bg-success/20">
            {comercialClients.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="ads" className="text-xs">
          ADS
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1 bg-info/20">
            {adsClients.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="unassigned" className="text-xs">
          ⚠️
          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1 bg-warning/20">
            {unassigned.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <TabsContent value="all" className="mt-0 pr-2">
            {renderClientList(clients, 'Nenhum cliente novo')}
          </TabsContent>
          <TabsContent value="comercial" className="mt-0 pr-2">
            {renderClientList(comercialClients, 'Nenhum no Comercial')}
          </TabsContent>
          <TabsContent value="ads" className="mt-0 pr-2">
            {renderClientList(adsClients, 'Nenhum em Ads')}
          </TabsContent>
          <TabsContent value="unassigned" className="mt-0 pr-2">
            {renderClientList(unassigned, 'Todos atribuídos!')}
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}
