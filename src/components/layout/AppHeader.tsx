import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, ChevronDown, Camera } from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
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

// All searchable pages in the system
const SEARCHABLE_PAGES = [
  { path: '/ceo', label: 'Indicadores', category: 'CEO' },
  { path: '/kanban/ceo', label: 'Kanban CEO', category: 'CEO' },
  { path: '/okrs-millennials', label: 'OKRs Millennials', category: 'CEO' },
  { path: '/tv-dashboard', label: 'TV Dashboard', category: 'CEO' },
  { path: '/millennials-growth', label: 'Dashboard Millennials Growth', category: 'Produtos' },
  { path: '/outbound-dashboard', label: 'Dashboard Outbound', category: 'Produtos' },
  { path: '/kanban/design', label: 'Kanban Design', category: 'Kanbans' },
  { path: '/kanban/editor-video', label: 'Kanban Editor de Vídeo', category: 'Kanbans' },
  { path: '/kanban/devs', label: 'Kanban Desenvolvedores', category: 'Kanbans' },
  { path: '/kanban/atrizes', label: 'Kanban Atrizes para Gravação', category: 'Kanbans' },
  { path: '/kanban/produtora', label: 'Kanban Produtora', category: 'Kanbans' },
  { path: '/kanban/crm', label: 'Kanban CRM', category: 'Kanbans' },
  { path: '/kanban/comercial', label: 'Kanban Comercial', category: 'Kanbans' },
  { path: '/kanban/ads', label: 'Kanban Gestor de Ads', category: 'Kanbans' },
  { path: '/kanban/sucesso', label: 'Kanban Sucesso do Cliente', category: 'Kanbans' },
  { path: '/gestor-ads', label: 'Gestão de Tráfego PRO+', category: 'PRO+' },
  { path: '/millennials-outbound', label: 'Outbound PRO+', category: 'PRO+' },
  { path: '/sucesso-cliente', label: 'Sucesso do Cliente PRO+', category: 'PRO+' },
  { path: '/consultor-comercial', label: 'Comercial PRO+', category: 'PRO+' },
  { path: '/financeiro', label: 'Financeiro PRO+', category: 'PRO+' },
  { path: '/gestor-projetos', label: 'Gestão de Projetos PRO+', category: 'PRO+' },
  { path: '/gestor-crm', label: 'CRM PRO+', category: 'PRO+' },
  { path: '/design', label: 'Design PRO+', category: 'PRO+' },
  { path: '/editor-video', label: 'Editor de Vídeo PRO+', category: 'PRO+' },
  { path: '/devs', label: 'Desenvolvedor PRO+', category: 'PRO+' },
  { path: '/atrizes-gravacao', label: 'Gravação PRO+', category: 'PRO+' },
  { path: '/rh', label: 'RH', category: 'PRO+' },
  { path: '/lista-clientes', label: 'Lista de Clientes (Todos)', category: 'Clientes' },
  { path: '/clientes/millennials-growth', label: 'Clientes Millennials Growth', category: 'Clientes' },
  { path: '/clientes/millennials-outbound', label: 'Clientes Outbound', category: 'Clientes' },
  { path: '/clientes/zydon', label: 'Clientes Zydon', category: 'Clientes' },
  { path: '/clientes/torque-crm', label: 'Clientes Torque CRM', category: 'Clientes' },
  { path: '/clientes/kasd', label: 'Clientes KASD', category: 'Clientes' },
  { path: '/clientes/fenix', label: 'Clientes Fenix', category: 'Clientes' },
  { path: '/cadastro-clientes', label: 'Cadastro de Clientes', category: 'Clientes' },
  { path: '/upsells', label: 'UP Sells', category: 'Financeiro' },
  { path: '/comissoes', label: 'Comissões', category: 'Financeiro' },
  { path: '/financeiro-dashboard', label: 'Financeiro Dashboard', category: 'Financeiro' },
  { path: '/treinamentos', label: 'Treinamentos', category: 'Outros' },
  { path: '/admin/usuarios', label: 'Gestão de Usuários', category: 'Admin' },
  { path: '/admin/grupos', label: 'Grupos', category: 'Admin' },
  { path: '/admin/configuracoes', label: 'Configurações', category: 'Admin' },
];

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

  const pageTitle = pageTitles[location.pathname] || 'Sistema';

  // Filter search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return SEARCHABLE_PAGES.filter(page => {
      const label = page.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const category = page.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return label.includes(q) || category.includes(q);
    }).slice(0, 8);
  }, [searchQuery]);

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
