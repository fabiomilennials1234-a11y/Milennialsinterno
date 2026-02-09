import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OnboardingClient {
  id: string;
  name: string;
  current_milestone: number | null;
  onboarding_started_at: string | null;
  campaign_published_at: string | null;
}

const MILESTONES = [
  { num: 1, label: 'Briefing' },
  { num: 2, label: 'Estratégia' },
  { num: 3, label: 'Criativos' },
  { num: 4, label: 'Campanha' },
  { num: 5, label: 'Publicação' },
];

export default function SquadOnboardingSection() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['squad-onboarding-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          onboarding_started_at,
          campaign_published_at,
          client_onboarding (
            current_milestone
          )
        `)
        .eq('archived', false)
        .not('onboarding_started_at', 'is', null)
        .is('campaign_published_at', null)
        .order('onboarding_started_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        current_milestone: c.client_onboarding?.[0]?.current_milestone || 1,
        onboarding_started_at: c.onboarding_started_at,
        campaign_published_at: c.campaign_published_at,
      }));
    },
  });

  const groupedByMilestone = useMemo(() => {
    const groups: Record<number, OnboardingClient[]> = {};
    MILESTONES.forEach(m => groups[m.num] = []);
    
    clients.forEach(client => {
      const milestone = client.current_milestone || 1;
      if (groups[milestone]) {
        groups[milestone].push(client);
      }
    });
    
    return groups;
  }, [clients]);

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
        <p className="font-medium text-sm">Nenhum cliente em onboarding</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-2">
        {MILESTONES.map(milestone => {
          const clientsInMilestone = groupedByMilestone[milestone.num] || [];
          
          return (
            <div key={milestone.num} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    clientsInMilestone.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {milestone.num}
                  </div>
                  <span className="text-sm font-medium text-foreground">{milestone.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {clientsInMilestone.length}
                </Badge>
              </div>
              
              {clientsInMilestone.length > 0 ? (
                <div className="pl-8 space-y-1">
                  {clientsInMilestone.map(client => (
                    <div
                      key={client.id}
                      className="text-sm text-muted-foreground py-1 px-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      {client.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pl-8 text-xs text-muted-foreground/60 italic">
                  Nenhum cliente
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
