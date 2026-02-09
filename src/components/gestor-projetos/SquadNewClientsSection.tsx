import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SquadNewClientsSection() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['squad-new-clients'],
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

      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserPlus className="mx-auto mb-2 opacity-50" size={32} />
        <p className="font-medium text-sm">Nenhum cliente novo</p>
        <p className="text-xs mt-1">Últimos 7 dias</p>
      </div>
    );
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'onboarding':
        return <Badge variant="secondary" className="bg-info/10 text-info text-xs">Onboarding</Badge>;
      case 'active':
        return <Badge variant="secondary" className="bg-success/10 text-success text-xs">Ativo</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="bg-warning/10 text-warning text-xs">Pausado</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Novo</Badge>;
    }
  };

  const hasAssignment = (client: typeof clients[0]) => {
    return client.assigned_ads_manager || client.assigned_comercial;
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        {clients.map(client => (
          <div
            key={client.id}
            className="p-3 rounded-lg bg-muted/50 border border-subtle space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {client.name}
              </p>
              {getStatusBadge(client.status)}
            </div>
            
            <div className="flex flex-wrap gap-1 text-xs">
              {client.assigned_ads_manager && (
                <Badge variant="outline" className="text-xs bg-info/5">
                  ✓ Ads
                </Badge>
              )}
              {client.assigned_comercial && (
                <Badge variant="outline" className="text-xs bg-success/5">
                  ✓ Comercial
                </Badge>
              )}
              {!hasAssignment(client) && (
                <Badge variant="outline" className="text-xs text-warning">
                  Sem atribuição
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(client.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
