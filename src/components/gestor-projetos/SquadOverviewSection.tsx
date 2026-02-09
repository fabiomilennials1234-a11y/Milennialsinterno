import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, UserPlus, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface OverviewStats {
  totalActiveClients: number;
  newClientsThisWeek: number;
  clientsInOnboarding: number;
  delayedItems: number;
  completedToday: number;
}

export default function SquadOverviewSection() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['squad-overview-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Total active clients
      const { count: totalActive } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
        .eq('status', 'active');

      // New clients this week
      const { count: newClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
        .gte('created_at', sevenDaysAgo.toISOString());

      // Clients in onboarding
      const { count: inOnboarding } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
        .not('onboarding_started_at', 'is', null)
        .is('campaign_published_at', null);

      // Delayed ads tasks
      const { count: delayedAdsTasks } = await supabase
        .from('ads_tasks')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false);

      // Delayed comercial tasks
      const { count: delayedComercialTasks } = await supabase
        .from('comercial_tasks')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false);

      // Completed tasks today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { count: completedAds } = await supabase
        .from('ads_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', todayStart.toISOString());

      const { count: completedComercial } = await supabase
        .from('comercial_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', todayStart.toISOString());

      return {
        totalActiveClients: totalActive || 0,
        newClientsThisWeek: newClients || 0,
        clientsInOnboarding: inOnboarding || 0,
        delayedItems: (delayedAdsTasks || 0) + (delayedComercialTasks || 0),
        completedToday: (completedAds || 0) + (completedComercial || 0),
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

  const metrics = [
    {
      label: 'Clientes Ativos',
      value: stats?.totalActiveClients || 0,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Novos (7 dias)',
      value: stats?.newClientsThisWeek || 0,
      icon: UserPlus,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Em Onboarding',
      value: stats?.clientsInOnboarding || 0,
      icon: Clock,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: 'Atrasados',
      value: stats?.delayedItems || 0,
      icon: AlertTriangle,
      color: stats?.delayedItems ? 'text-danger' : 'text-muted-foreground',
      bgColor: stats?.delayedItems ? 'bg-danger/10' : 'bg-muted',
    },
    {
      label: 'Concluídos Hoje',
      value: stats?.completedToday || 0,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <div className="space-y-3">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-subtle"
          >
            <div className={`p-2 rounded-lg ${metric.bgColor}`}>
              <Icon className={`w-4 h-4 ${metric.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className={`text-lg font-bold ${metric.color}`}>{metric.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
