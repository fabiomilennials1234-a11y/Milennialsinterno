import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DepartmentStats {
  department: string;
  color: string;
  bgColor: string;
  totalClients: number;
  inOnboarding: number;
  delayed: number;
  completedToday: number;
}

export default function SquadDepartmentMetricsSection() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['squad-department-metrics'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Comercial stats
      const { count: comercialClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
        .not('assigned_comercial', 'is', null);

      const { count: comercialOnboarding } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
        .not('assigned_comercial', 'is', null)
        .eq('comercial_status', 'consultoria_marcada');

      const { count: comercialDelayed } = await supabase
        .from('comercial_tasks')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false);

      const { count: comercialCompleted } = await supabase
        .from('comercial_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', todayStart.toISOString());

      // Ads stats
      const { count: adsClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
        .not('assigned_ads_manager', 'is', null);

      const { count: adsOnboarding } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)
        .not('assigned_ads_manager', 'is', null)
        .not('onboarding_started_at', 'is', null)
        .is('campaign_published_at', null);

      const { count: adsDelayed } = await supabase
        .from('ads_tasks')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', today)
        .neq('status', 'completed')
        .eq('archived', false);

      const { count: adsCompleted } = await supabase
        .from('ads_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', todayStart.toISOString());

      return [
        {
          department: 'Comercial',
          color: 'text-success',
          bgColor: 'bg-success/10',
          totalClients: comercialClients || 0,
          inOnboarding: comercialOnboarding || 0,
          delayed: comercialDelayed || 0,
          completedToday: comercialCompleted || 0,
        },
        {
          department: 'Gestão de Ads',
          color: 'text-info',
          bgColor: 'bg-info/10',
          totalClients: adsClients || 0,
          inOnboarding: adsOnboarding || 0,
          delayed: adsDelayed || 0,
          completedToday: adsCompleted || 0,
        },
        {
          department: 'Design',
          color: 'text-purple',
          bgColor: 'bg-purple/10',
          totalClients: 0,
          inOnboarding: 0,
          delayed: 0,
          completedToday: 0,
        },
        {
          department: 'Vídeo',
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          totalClients: 0,
          inOnboarding: 0,
          delayed: 0,
          completedToday: 0,
        },
      ] as DepartmentStats[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-2">
        {stats?.map((dept) => (
          <div
            key={dept.department}
            className={`p-4 rounded-xl border border-subtle ${dept.bgColor}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-semibold text-sm ${dept.color}`}>
                {dept.department}
              </h3>
              {dept.delayed > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {dept.delayed} atrasados
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                  <p className="text-sm font-bold text-foreground">{dept.totalClients}</p>
                </div>
              </div>

              {(dept.department === 'Comercial' || dept.department === 'Gestão de Ads') && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Onboarding</p>
                    <p className="text-sm font-bold text-foreground">{dept.inOnboarding}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                <AlertTriangle className={`w-3.5 h-3.5 ${dept.delayed > 0 ? 'text-danger' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Atrasados</p>
                  <p className={`text-sm font-bold ${dept.delayed > 0 ? 'text-danger' : 'text-foreground'}`}>
                    {dept.delayed}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                  <p className="text-sm font-bold text-success">{dept.completedToday}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
