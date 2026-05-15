import { useMemo } from 'react';
import { Loader2, Users, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useGrowthAcompanhamento } from '@/hooks/useGrowthOnboarding';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import ClientTagBadge from '@/components/client-tags/ClientTagBadge';
import { TAG_TORQUE_BLOQUEADO } from '@/components/client-tags/ClientTagsList';

export default function GrowthAcompanhamentoSection() {
  const { data: clients = [], isLoading } = useGrowthAcompanhamento();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: tagsMap } = useClientTagsBatch(clientIds);

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
        <CheckCircle2 className="mx-auto mb-2 opacity-50" size={32} />
        <p className="font-medium text-sm">Nenhum cliente Growth em acompanhamento</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 pr-2">
        {clients.map(client => {
          const tags = tagsMap?.get(client.id) || [];
          const displayName = client.razao_social || client.name;

          return (
            <div
              key={client.id}
              className="p-3 rounded-lg bg-muted/50 border border-subtle space-y-2 hover:bg-muted/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users size={14} className="text-muted-foreground shrink-0" />
                <p className="text-sm font-medium text-foreground truncate">
                  {displayName}
                </p>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <ClientTagBadge
                      key={tag.id}
                      name={tag.name}
                      createdAt={tag.created_at}
                      expiresAt={tag.expires_at}
                      expiredAt={tag.expired_at}
                      size="sm"
                      counterMode={tag.name === TAG_TORQUE_BLOQUEADO ? 'elapsed' : 'countdown'}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
