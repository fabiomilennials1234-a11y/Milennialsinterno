import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { User, UserRole, isAdmin, canViewTab, canCreateTab, canMoveCardsFreely, canManageUsers } from '@/types/auth';
import { supabase } from '@/integrations/supabase/client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

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

  // Ref holds current user to avoid stale closures in async callbacks.
  // Without this, fetchUserData failure inside onAuthStateChange would
  // read a stale `user` from the initial render closure and clear it.
  const userRef = useRef<ExtendedUser | null>(null);

  // Tracks whether initial hydration happened (either via getSession or
  // INITIAL_SESSION event). Prevents duplicate hydration on cold start.
  const hydratedRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Bootstrap: getSession() + onAuthStateChange.
  // getSession() handles the case where INITIAL_SESSION fires before
  // useEffect runs. onAuthStateChange covers all subsequent changes.
  useEffect(() => {
    let cancelled = false;

    // Full hydration: fetch profile + role, set user + session.
    // If fetchUserData fails (network blip, RLS timeout) but we already
    // have a valid user in state, keep the existing user instead of
    // forcing a visual logout.
    const hydrateWithUserData = async (nextSession: Session | null) => {
      if (cancelled) return;
      setSession(nextSession);
      if (nextSession?.user) {
        const userData = await fetchUserData(nextSession.user.id);
        if (cancelled) return;
        if (userData) {
          setUser(userData);
        } else if (userRef.current) {
          // WHY: fetchUserData returned null (network blip, RLS timeout)
          // but session is valid and we have prior user data. Preserving
          // avoids visual logout. Will self-heal on next successful fetch.
          console.warn(
            '[AuthContext] fetchUserData returned null with valid session — preserving existing user data'
          );
        } else {
          // No prior user data (first login, new tab) — nothing to preserve
          setUser(null);
        }
      } else {
        setUser(null);
      }
      if (!cancelled) setIsLoading(false);
    };

    // Light hydration: only update session token, skip profile queries.
    // Used for TOKEN_REFRESHED — user data doesn't change on token refresh.
    const hydrateSessionOnly = (nextSession: Session | null) => {
      if (cancelled) return;
      setSession(nextSession);
    };

    const clearAuth = () => {
      if (cancelled) return;
      setUser(null);
      setSession(null);
      setIsLoading(false);
    };

    // Handle auth events with discrimination by type
    const handleAuthEvent = (event: AuthChangeEvent, nextSession: Session | null) => {
      switch (event) {
        case 'INITIAL_SESSION':
          // Bootstrap — but skip if getSession already hydrated
          if (!hydratedRef.current) {
            hydratedRef.current = true;
            void hydrateWithUserData(nextSession);
          }
          break;

        case 'SIGNED_IN':
        case 'USER_UPDATED':
          hydratedRef.current = true;
          void hydrateWithUserData(nextSession);
          break;

        case 'TOKEN_REFRESHED':
          // Session token rotated (~every 60min). User data unchanged.
          // Avoids 2 unnecessary queries and eliminates the risk of
          // fetchUserData failure causing visual logout (Bug 1 + Bug 2).
          hydrateSessionOnly(nextSession);
          break;

        case 'SIGNED_OUT':
          clearAuth();
          break;

        case 'PASSWORD_RECOVERY':
        case 'MFA_CHALLENGE_VERIFIED':
          // Session may have changed, update it. User data unchanged.
          hydrateSessionOnly(nextSession);
          break;

        default:
          // Future events — safe default: update session only
          hydrateSessionOnly(nextSession);
          break;
      }
    };

    // getSession covers the race where INITIAL_SESSION fires before
    // this useEffect mounts.
    supabase.auth.getSession().then(({ data }) => {
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        void hydrateWithUserData(data.session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthEvent);

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
    // Limpa preferências de scope (visão "minhas/todas") do localStorage
    // para não vazar entre usuários no mesmo navegador.
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('page-data-scope:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (session?.user) {
      const userData = await fetchUserData(session.user.id);
      if (userData) {
        setUser(userData);
      } else if (userRef.current) {
        console.warn('[AuthContext] refreshUser: fetchUserData returned null — preserving existing user');
      }
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
