import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, ChevronDown, Camera, Moon, Sun } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import { ROLE_LABELS } from '@/types/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import ProfileAvatarUpload from '@/components/profile/ProfileAvatarUpload';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { useThemeMode } from '@/hooks/useThemeMode';
import { SEARCHABLE_PAGES } from '@/components/layout/searchablePages';

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
  '/kanban/comercial': 'Treinador Comercial',
  '/kanban/ads': 'Gestor de Ads',
  '/kanban/sucesso': 'Sucesso do Cliente',
  '/kanban/financeiro': 'Financeiro',
  '/kanban/rh': 'RH',
  '/admin/usuarios': 'Gestão de Usuários',
  '/admin/configuracoes': 'Configurações',
};

// SEARCHABLE_PAGES vive em `./searchablePages.ts` — manter constantes em arquivo
// próprio preserva o contrato de `react-refresh/only-export-components` e facilita
// testar o filtro de roles isoladamente.

export default function AppHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [avatarUploadOpen, setAvatarUploadOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | undefined>(user?.avatar);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Board `comercial` é único global; scope de cards via RLS por client.group_id
  // (decisão Opus B, migration 20260423120000). Match estático em `pageTitles` basta.
  const pageTitle = pageTitles[location.pathname] || 'Sistema';
  const { isDark, toggle: toggleTheme } = useThemeMode();

  // Admins (CEO/CTO/gestor_projetos) passam por cima de qualquer `allowedRoles`.
  // Alinha com ExecutiveRoute/AdminRoute em App.tsx.
  const isAdminOrExecutive = useMemo(() => {
    const role = user?.role;
    if (!role) return false;
    return role === 'ceo' || role === 'cto' || role === 'gestor_projetos';
  }, [user?.role]);

  // P\u00e1ginas vis\u00edveis pro usu\u00e1rio atual, j\u00e1 filtradas por role. `allowedRoles`
  // ausente = p\u00fablica; `allowedRoles: []` = s\u00f3 admins veem.
  const visiblePages = useMemo(() => {
    return SEARCHABLE_PAGES.filter(page => {
      if (!page.allowedRoles) return true;
      if (isAdminOrExecutive) return true;
      if (!user?.role) return false;
      return page.allowedRoles.includes(user.role);
    });
  }, [isAdminOrExecutive, user?.role]);

  // Filter search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return visiblePages.filter(page => {
      const label = page.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const category = page.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return label.includes(q) || category.includes(q);
    }).slice(0, 8);
  }, [searchQuery, visiblePages]);

  // Reset selected index when results change
  useEffect(() => { setSelectedIndex(0); }, [searchResults]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchNavigate = useCallback((path: string) => {
    navigate(path);
    setSearchQuery('');
    setSearchOpen(false);
    inputRef.current?.blur();
  }, [navigate]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!searchResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchNavigate(searchResults[selectedIndex].path);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      inputRef.current?.blur();
    }
  }, [searchResults, selectedIndex, handleSearchNavigate]);

  const handleAvatarUpdated = useCallback(async (newAvatarUrl: string) => {
    setCurrentAvatar(newAvatarUrl);
    // Invalidate queries to refresh avatar across the app
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }, [queryClient]);

  // Sync avatar when user changes
  const displayAvatar = currentAvatar || user?.avatar;

  return (
    <>
      <header className="h-16 px-6 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm relative z-50">
        {/* Page Title */}
        <div>
          <h1 className="font-display text-lg font-semibold text-foreground tracking-wide uppercase">
            {pageTitle}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={18} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar página..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
              onKeyDown={handleSearchKeyDown}
              className="pl-10 pr-4 py-2 rounded-xl bg-muted/50 border border-border text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30
                         focus:border-primary transition-all w-64"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-[9999]">
                {searchResults.map((result, index) => (
                  <button
                    key={result.path}
                    onClick={() => handleSearchNavigate(result.path)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className="truncate">{result.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{result.category}</span>
                  </button>
                ))}
              </div>
            )}
            {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-[9999] p-4">
                <p className="text-sm text-muted-foreground text-center">Nenhuma página encontrada</p>
              </div>
            )}
          </div>

          {/* Notifications */}
          <NotificationCenter />

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
              <DropdownMenuLabel className="text-[11px] font-medium tracking-[-0.005em] text-muted-foreground">
                Minha conta
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={() => setAvatarUploadOpen(true)}
                className="cursor-pointer"
              >
                <Camera size={16} className="mr-2" />
                Alterar foto de perfil
              </DropdownMenuItem>

              {/* Theme toggle — não fecha o menu ao alternar */}
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={toggleTheme}
                className="cursor-pointer flex items-center justify-between gap-2"
                aria-label={isDark ? 'Desativar modo escuro' : 'Ativar modo escuro'}
              >
                <span className="flex items-center">
                  {isDark ? (
                    <Moon size={16} className="mr-2" />
                  ) : (
                    <Sun size={16} className="mr-2" />
                  )}
                  Modo escuro
                </span>
                <Switch
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Alternar modo escuro"
                />
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={logout} className="text-danger cursor-pointer focus:text-danger">
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
