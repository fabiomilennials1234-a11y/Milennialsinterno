import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, ROLE_LABELS } from '@/types/auth';

export interface GroupRoleLimit {
  id: string;
  group_id: string;
  role: string;
  max_count: number;
}

export interface GroupRoleOccupancy {
  role: UserRole;
  label: string;
  current: number;
  max: number;
}

export interface GroupWithOccupancy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  squads: SquadInfo[];
  roleOccupancy: GroupRoleOccupancy[];
  totalMembers: number;
  totalCapacity: number;
}

export interface SquadInfo {
  id: string;
  name: string;
  slug: string;
  group_id: string;
  position: number;
  memberCount: number;
}

// Fetch groups with occupancy data
export function useGroupsWithOccupancy() {
  return useQuery({
    queryKey: ['groups-with-occupancy'],
    queryFn: async (): Promise<GroupWithOccupancy[]> => {
      // Fetch groups
      const { data: groups, error: groupsError } = await supabase
        .from('organization_groups')
        .select('*')
        .order('position');
      
      if (groupsError) throw groupsError;
      if (!groups) return [];

      // Fetch squads
      const { data: squads } = await supabase
        .from('squads')
        .select('*')
        .order('position');

      // Fetch role limits
      const { data: roleLimits } = await supabase
        .from('group_role_limits')
        .select('*');

      // Fetch profiles to count members per group
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, group_id, squad_id, user_id');

      // Fetch user roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Map profiles with roles
      const profilesWithRoles = profiles?.map(p => ({
        ...p,
        role: userRoles?.find(ur => ur.user_id === p.user_id)?.role,
      })) || [];

      return groups.map(group => {
        // Filter profiles in this group
        const groupProfiles = profilesWithRoles.filter(p => p.group_id === group.id);
        
        // Get limits for this group
        const groupLimits = roleLimits?.filter(l => l.group_id === group.id) || [];
        
        // Build occupancy per role
        const roleOccupancy: GroupRoleOccupancy[] = groupLimits.map(limit => {
          const current = groupProfiles.filter(p => p.role === limit.role).length;
          return {
            role: limit.role as UserRole,
            label: ROLE_LABELS[limit.role as UserRole] || limit.role,
            current,
            max: limit.max_count,
          };
        });

        // Filter squads for this group
        const groupSquads = squads?.filter(s => s.group_id === group.id).map(s => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          group_id: s.group_id,
          position: s.position,
          memberCount: profilesWithRoles.filter(p => p.squad_id === s.id).length,
        })) || [];

        const totalCapacity = roleOccupancy.reduce((sum, r) => sum + r.max, 0);

        return {
          id: group.id,
          name: group.name,
          slug: group.slug,
          description: group.description,
          position: group.position,
          squads: groupSquads,
          roleOccupancy,
          totalMembers: groupProfiles.length,
          totalCapacity,
        };
      });
    },
  });
}

// Create a new group
export function useCreateGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      name: string; 
      description?: string;
      roleLimits: { role: UserRole; max_count: number }[];
    }) => {
      const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Get next position
      const { data: groups } = await supabase
        .from('organization_groups')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
      
      const nextPosition = (groups?.[0]?.position || 0) + 1;
      
      // Insert group
      const { data: newGroup, error: groupError } = await supabase
        .from('organization_groups')
        .insert({
          name: data.name,
          slug,
          description: data.description || null,
          position: nextPosition,
        })
        .select()
        .single();
      
      if (groupError) throw groupError;
      
      // Insert role limits
      if (data.roleLimits.length > 0) {
        const { error: limitsError } = await supabase
          .from('group_role_limits')
          .insert(
            data.roleLimits.map(rl => ({
              group_id: newGroup.id,
              role: rl.role,
              max_count: rl.max_count,
            }))
          );
        
        if (limitsError) throw limitsError;
      }
      
      return newGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups-with-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['organization-groups'] });
    },
  });
}

// Update group
export function useUpdateGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      id: string;
      name?: string; 
      description?: string;
      roleLimits?: { role: UserRole; max_count: number }[];
    }) => {
      // Update group
      const updates: Record<string, unknown> = {};
      if (data.name) {
        updates.name = data.name;
        updates.slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
      if (data.description !== undefined) updates.description = data.description;
      
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('organization_groups')
          .update(updates)
          .eq('id', data.id);
        
        if (error) throw error;
      }
      
      // Update role limits
      if (data.roleLimits) {
        // Delete existing and insert new
        await supabase
          .from('group_role_limits')
          .delete()
          .eq('group_id', data.id);
        
        if (data.roleLimits.length > 0) {
          const { error } = await supabase
            .from('group_role_limits')
            .insert(
              data.roleLimits.map(rl => ({
                group_id: data.id,
                role: rl.role,
                max_count: rl.max_count,
              }))
            );
          
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups-with-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['organization-groups'] });
    },
  });
}

// Delete group (with option to delete users)
export function useDeleteGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ groupId, deleteUsers = true }: { groupId: string; deleteUsers?: boolean }) => {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('delete-group', {
        body: { groupId, deleteUsers },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao remover grupo');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups-with-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['organization-groups'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Create squad
export function useCreateSquad() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      name: string; 
      group_id: string;
      description?: string;
    }) => {
      const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Get next position in group
      const { data: squads } = await supabase
        .from('squads')
        .select('position')
        .eq('group_id', data.group_id)
        .order('position', { ascending: false })
        .limit(1);
      
      const nextPosition = (squads?.[0]?.position || 0) + 1;
      
      const { data: newSquad, error } = await supabase
        .from('squads')
        .insert({
          name: data.name,
          slug,
          group_id: data.group_id,
          description: data.description || null,
          position: nextPosition,
        })
        .select()
        .single();
      
      if (error) throw error;
      return newSquad;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups-with-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['organization-groups'] });
      queryClient.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}

// Delete squad
export function useDeleteSquad() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (squadId: string) => {
      const { error } = await supabase
        .from('squads')
        .delete()
        .eq('id', squadId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups-with-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['organization-groups'] });
      queryClient.invalidateQueries({ queryKey: ['squads'] });
    },
  });
}
