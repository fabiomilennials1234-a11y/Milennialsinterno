import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { Bell, Search, LogOut, ChevronDown, Camera } from 'lucide-react';
import { ROLE_LABELS } from '@/types/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import ProfileAvatarUpload from '@/components/profile/ProfileAvatarUpload';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dash Master',
  '/kanban/design': 'Design',
  '/kanban/editor-video': 'Editor de Vídeo',
  '/kanban/devs': 'Desenvolvedores',
  '/kanban/atrizes': 'Atrizes para Gravação',
  '/kanban/produtora': 'Produtora',
  '/kanban/crm': 'Gestor de CRM',
  '/kanban/comercial': 'Consultor Comercial',
  '/kanban/ads': 'Gestor de Ads',
  '/kanban/sucesso': 'Sucesso do Cliente',
  '/kanban/financeiro': 'Financeiro',
  '/kanban/rh': 'RH',
  '/admin/usuarios': 'Gestão de Usuários',
  '/admin/configuracoes': 'Configurações',
};

export default function AppHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [avatarUploadOpen, setAvatarUploadOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | undefined>(user?.avatar);
  
  const pageTitle = pageTitles[location.pathname] || 'Sistema';

  const handleAvatarUpdated = useCallback(async (newAvatarUrl: string) => {
    setCurrentAvatar(newAvatarUrl);
    // Invalidate queries to refresh avatar across the app
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }, [queryClient]);

  // Sync avatar when user changes
  const displayAvatar = currentAvatar || user?.avatar;

  return (
    <>
      <header className="h-16 px-6 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm">
        {/* Page Title */}
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground tracking-wide uppercase">
            {pageTitle}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 rounded-xl bg-muted/50 border border-border text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30
                         focus:border-primary transition-all w-64"
            />
          </div>

          {/* Notifications */}
          <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full"></span>
          </button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                <Avatar className="w-8 h-8">
                  {displayAvatar ? (
                    <AvatarImage src={displayAvatar} alt={user?.name} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-bold text-sm">
                    {user?.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user && ROLE_LABELS[user.role]}</p>
                </div>
                <ChevronDown size={16} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-popover border-border">
              <DropdownMenuLabel className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                Minha Conta
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => setAvatarUploadOpen(true)} 
                className="cursor-pointer"
              >
                <Camera size={16} className="mr-2" />
                Alterar Foto de Perfil
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={logout} className="text-danger cursor-pointer">
                <LogOut size={16} className="mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Avatar Upload Modal */}
      {user && (
        <ProfileAvatarUpload
          open={avatarUploadOpen}
          onOpenChange={setAvatarUploadOpen}
          userId={user.id}
          currentAvatar={displayAvatar}
          onAvatarUpdated={handleAvatarUpdated}
        />
      )}
    </>
  );
}
