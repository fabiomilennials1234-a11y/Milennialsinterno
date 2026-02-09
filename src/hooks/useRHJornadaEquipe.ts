import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types for Team Journey management
export interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  role: string;
  department?: string;
  hire_date?: string;
  birth_date?: string;
  current_salary?: number;
  status: 'active' | 'onboarding' | 'notice_period' | 'terminated';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CareerEvent {
  id: string;
  member_id: string;
  event_type: 'promotion' | 'salary_increase' | 'role_change' | 'department_transfer' | 'warning' | 'recognition' | 'training' | 'anniversary';
  title: string;
  description?: string;
  event_date: string;
  old_value?: string;
  new_value?: string;
  created_by?: string;
  created_at: string;
}

export interface CommemorativeDate {
  id: string;
  member_id?: string;
  date_type: 'birthday' | 'work_anniversary' | 'company_event' | 'holiday' | 'custom';
  title: string;
  description?: string;
  event_date: string;
  recurring: boolean;
  created_at: string;
}

// Jornada Equipe Statuses (Kanban columns)
export const JORNADA_STATUSES = [
  { id: 'onboarding', label: 'Onboarding', color: '#6366f1', icon: 'UserPlus' },
  { id: 'integracao', label: 'Integração', color: '#8b5cf6', icon: 'Users' },
  { id: 'desenvolvimento', label: 'Desenvolvimento', color: '#3b82f6', icon: 'TrendingUp' },
  { id: 'promocao', label: 'Promoção/Avaliação', color: '#22c55e', icon: 'Award' },
  { id: 'datas_comemorativas', label: 'Datas Comemorativas', color: '#f59e0b', icon: 'Calendar' },
  { id: 'desligamento', label: 'Desligamento', color: '#dc2626', icon: 'LogOut' },
] as const;

export type JornadaStatus = typeof JORNADA_STATUSES[number]['id'];

// Card type for the Jornada Kanban
export interface JornadaCard {
  id: string;
  status: JornadaStatus;
  card_type: 'member' | 'event' | 'date' | 'task';
  title: string;
  description?: string;
  member_id?: string;
  member_name?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  event_type?: string;
  position: number;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

// Helper to get status label
export function getJornadaStatusLabel(status: string): string {
  const found = JORNADA_STATUSES.find(s => s.id === status);
  return found?.label || status;
}

// Helper to get status color
export function getJornadaStatusColor(status: string): string {
  const found = JORNADA_STATUSES.find(s => s.id === status);
  return found?.color || '#6366f1';
}

// Fetch profiles to use as team members
export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      // First get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });
      
      if (profilesError) throw profilesError;
      
      // Get user roles to map to profiles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      const roleMap = new Map<string, string>();
      (userRoles || []).forEach(ur => roleMap.set(ur.user_id, ur.role));
      
      return (profiles || []).map(profile => ({
        id: profile.id || profile.user_id,
        user_id: profile.user_id,
        name: profile.name || 'Sem nome',
        role: roleMap.get(profile.user_id) || 'unknown',
        hire_date: profile.created_at,
        status: 'active' as const,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      })) as TeamMember[];
    },
  });
}

// Get upcoming birthdays and anniversaries from profiles
export function useUpcomingDates() {
  const { data: members = [] } = useTeamMembers();
  
  const upcomingDates: CommemorativeDate[] = [];
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  members.forEach(member => {
    // Work anniversary based on hire date
    if (member.hire_date) {
      const hireDate = new Date(member.hire_date);
      const thisYearAnniversary = new Date(
        today.getFullYear(),
        hireDate.getMonth(),
        hireDate.getDate()
      );
      
      if (thisYearAnniversary >= today && thisYearAnniversary <= thirtyDaysFromNow) {
        const yearsWorking = today.getFullYear() - hireDate.getFullYear();
        upcomingDates.push({
          id: `anniversary-${member.id}`,
          member_id: member.id,
          date_type: 'work_anniversary',
          title: `${yearsWorking} ano${yearsWorking > 1 ? 's' : ''} de ${member.name}`,
          event_date: thisYearAnniversary.toISOString(),
          recurring: true,
          created_at: new Date().toISOString(),
        });
      }
    }
  });
  
  return upcomingDates;
}

// Dashboard stats for Jornada Equipe
export function useJornadaDashboardStats() {
  const { data: members = [] } = useTeamMembers();
  const upcomingDates = useUpcomingDates();
  
  return {
    totalMembers: members.length,
    activeMembers: members.filter(m => m.status === 'active').length,
    onboardingMembers: members.filter(m => m.status === 'onboarding').length,
    upcomingEvents: upcomingDates.length,
    averageTenure: calculateAverageTenure(members),
  };
}

function calculateAverageTenure(members: TeamMember[]): number {
  const membersWithHireDate = members.filter(m => m.hire_date);
  if (membersWithHireDate.length === 0) return 0;
  
  const today = new Date();
  const totalDays = membersWithHireDate.reduce((sum, member) => {
    const hireDate = new Date(member.hire_date!);
    const days = Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);
  
  return Math.round(totalDays / membersWithHireDate.length / 30); // Return in months
}
