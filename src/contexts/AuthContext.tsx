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

  // Fetch user profile and role from database
  const fetchUserData = useCallback(async (userId: string): Promise<(User & { group_id?: string | null; squad_id?: string | null }) | null> => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      if (!profile) {
        console.error('No profile found for user');
        return null;
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
      }

      const role = (roleData?.role as UserRole) || 'design';

      return {
        id: profile.user_id,
        name: profile.name,
        email: profile.email,
        role,
        avatar: profile.avatar || undefined,
        group_id: profile.group_id,
        squad_id: profile.squad_id,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  // Set up auth state listener
  useEffect(() => {
    // Set up listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase
          setTimeout(async () => {
            const userData = await fetchUserData(session.user.id);
            setUser(userData);
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserData(session.user.id).then((userData) => {
          setUser(userData);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => {
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

      if (data.user) {
        const userData = await fetchUserData(data.user.id);
        if (userData) {
          setUser(userData);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, [fetchUserData]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const isCEO = user?.role === 'ceo';
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
