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

  // Busca perfil + role em 2 queries paralelas.
  // Tentativa anterior (c391cac) usou embed relacional profiles.user_roles(role)
  // mas PostgREST falha com PGRST200 porque não há FK entre profiles e user_roles.
  // 2 queries em Promise.all é mais robusto e quase tão rápido (mesmo RTT).
  const fetchUserData = useCallback(async (userId: string): Promise<(User & { group_id?: string | null; squad_id?: string | null }) | null> => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileRes.error) {
        console.error('Error fetching profile:', profileRes.error);
        return null;
      }
      if (!profileRes.data) {
        console.error('No profile found for user');
        return null;
      }
      if (roleRes.error) {
        console.error('Error fetching user role:', roleRes.error);
      }

      const profile = profileRes.data;
      const role = (roleRes.data?.role as UserRole) || 'design';

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

  // Bootstrap de sessão — getSession() + onAuthStateChange.
  // Padrão recomendado oficialmente pela Supabase. Só listener não basta:
  // INITIAL_SESSION pode ser emitido antes do useEffect rodar (race em cold
  // start com sessão persistida), deixando isLoading=true eternamente.
  // getSession() garante estado inicial; listener cobre mudanças depois.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async (nextSession: Session | null) => {
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
    };

    supabase.auth.getSession().then(({ data }) => {
      void hydrate(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void hydrate(nextSession);
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
