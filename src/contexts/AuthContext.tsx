import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User, UserRole, isAdmin, canViewTab, canCreateTab, canMoveCardsFreely, canManageUsers } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface ExtendedUser extends User {
  group_id?: string | null;
  squad_id?: string | null;
}

interface AuthContextType {
  user: ExtendedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Permissões
  isAdminUser: boolean;
  isCEO: boolean;
  canManageUsersFlag: boolean;
  canViewTabById: (tabId: string) => boolean;
  canCreateTabs: boolean;
  canMoveFreely: boolean;
  userGroupId: string | null;
  userSquadId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Busca perfil + role em 1 query (join relacional do PostgREST).
  // Antes: 2 RTTs sequenciais (profiles, user_roles). Depois: 1.
  const fetchUserData = useCallback(async (userId: string): Promise<(User & { group_id?: string | null; squad_id?: string | null }) | null> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role)')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user data:', error);
        return null;
      }
      if (!profile) {
        console.error('No profile found for user');
        return null;
      }

      // user_roles pode vir como array (one-to-many do PostgREST) ou objeto
      const roleRaw = Array.isArray((profile as Record<string, unknown>).user_roles)
        ? ((profile as { user_roles: Array<{ role: string }> }).user_roles[0]?.role)
        : (profile as { user_roles?: { role?: string } }).user_roles?.role;
      const role = (roleRaw as UserRole) || 'design';

      return {
        id: profile.user_id,
        name: profile.name,
        email: profile.email,
        role,
        avatar: profile.avatar || undefined,
        group_id: profile.group_id,
        squad_id: profile.squad_id,
        can_access_mtech: profile.can_access_mtech === true,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  // Bootstrap de sessão — fonte única de verdade.
  // O SDK v2+ dispara INITIAL_SESSION automaticamente no mount, então não
  // precisamos chamar getSession() separadamente. Isso elimina o race
  // condition do código anterior (duas queries paralelas competindo para
  // setar `user`).
  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession);

        if (nextSession?.user) {
          const userData = await fetchUserData(nextSession.user.id);
          if (cancelled) return;
          setUser(userData);
        } else {
          setUser(null);
        }
        if (!cancelled) setIsLoading(false);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        return false;
      }

      // O onAuthStateChange já vai hidratar user/session automaticamente.
      return !!data.user;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (session?.user) {
      const userData = await fetchUserData(session.user.id);
      setUser(userData);
    }
  }, [fetchUserData, session?.user?.id]);

  const isCEO = user?.role === 'ceo' || user?.role === 'cto';
  const isAdminUser = user ? isAdmin(user.role) : false;
  const canManageUsersFlag = user ? canManageUsers(user.role) : false;
  const canCreateTabs = user ? canCreateTab(user.role) : false;
  const canMoveFreely = user ? canMoveCardsFreely(user.role) : false;
  const userGroupId = user?.group_id || null;
  const userSquadId = user?.squad_id || null;

  const canViewTabById = useCallback((tabId: string) => {
    if (!user) return false;
    return canViewTab(user.role, tabId);
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && !!session,
    isLoading,
    login,
    logout,
    refreshUser,
    isAdminUser,
    isCEO,
    canManageUsersFlag,
    canViewTabById,
    canCreateTabs,
    canMoveFreely,
    userGroupId,
    userSquadId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
