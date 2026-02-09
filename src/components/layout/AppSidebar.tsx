import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { 
  LayoutDashboard, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Kanban,
  Crown,
  Building2,
  Briefcase,
  Wallet,
  Video,
  Camera,
  Folder,
  Target,
  User,
  UserPlus,
  List,
  TrendingUp,
  ShoppingCart,
  GraduationCap,
  Cloud,
  Package,
  Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, canViewBoard, UserRole } from '@/types/auth';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  useSidebarPermissions, 
  isAdsBoard, 
  getBoardPath, 
  getBoardLabel,
  SPECIAL_ROUTES
} from '@/hooks/useSidebarPermissions';

// Ícones das categorias independentes
const categoryIcons: Record<string, React.ElementType> = {
  users: Users,
  wallet: Wallet,
  video: Video,
  camera: Camera,
  UserPlus: UserPlus,
};

// Ícones das categorias de produtos
const productCategoryIcons: Record<string, React.ElementType> = {
  TrendingUp: TrendingUp,
  ShoppingCart: ShoppingCart,
  Users: Users,
  GraduationCap: GraduationCap,
  Building: Building2,
  Cloud: Cloud,
  Package: Package,
};

// Check if a path matches the current location (handles special routes)
function isPathActive(currentPath: string, targetPath: string): boolean {
  // Exact match
  if (currentPath === targetPath) return true;
  
  // Handle paths with trailing slashes
  const normalizedCurrent = currentPath.replace(/\/$/, '');
  const normalizedTarget = targetPath.replace(/\/$/, '');
  
  return normalizedCurrent === normalizedTarget;
}

export default function AppSidebar() {
  // Persist sidebar state in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-open-groups');
    return saved ? JSON.parse(saved) : {};
  });
  const [openSquads, setOpenSquads] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-open-squads');
    return saved ? JSON.parse(saved) : {};
  });
  const location = useLocation();
  const currentPath = location.pathname;

  const {
    user,
    isAdminUser,
    isCEO,
    userGroup,
    userSquad,
    userSpecialRoute,
    visibleGroups,
    visibleCategories,
    visibleBoards,
    boards,
    adsManagerBoards,
    productCategories,
    getGroupRoles,
    getSquadRoles,
    getCoringaRoles,
    getRoleKanbanPath,
    canViewBoard: userCanViewBoard,
  } = useSidebarPermissions();

  const [openProductCategories, setOpenProductCategories] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-open-product-categories');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem('sidebar-open-groups', JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    localStorage.setItem('sidebar-open-squads', JSON.stringify(openSquads));
  }, [openSquads]);

  useEffect(() => {
    localStorage.setItem('sidebar-open-product-categories', JSON.stringify(openProductCategories));
  }, [openProductCategories]);

  // Helper to check if a role's path is active
  const isRoleActive = (role: UserRole): boolean => {
    const rolePath = getRoleKanbanPath(role);
    return isPathActive(currentPath, rolePath);
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleSquad = (squadId: string) => {
    setOpenSquads(prev => ({ ...prev, [squadId]: !prev[squadId] }));
  };

  const toggleProductCategory = (categoryId: string) => {
    setOpenProductCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  // Board do CEO
  const ceoBoard = boards.find(b => b.slug === 'ceo');

  // ==========================================
  // COMPONENTES DE RENDERIZAÇÃO
  // ==========================================

  // Renderiza um link de board com lógica PRO+ automática
  const BoardLink = ({ board, size = 'sm' }: { board: { id: string; slug: string; name: string }; size?: 'sm' | 'md' }) => {
    const path = getBoardPath(board);
    const label = getBoardLabel(board);
    const IconComponent = isAdsBoard(board) ? Target : Kanban;
    const iconSize = size === 'sm' ? 12 : 14;

    return (
      <NavLink
        to={path}
        className={({ isActive }) => cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
          size === 'sm' ? "text-xs" : "text-sm",
          isActive 
            ? "bg-sidebar-primary text-sidebar-primary-foreground" 
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        )}
      >
        <IconComponent size={iconSize} />
        <span className="truncate">{label}</span>
      </NavLink>
    );
  };

  // Renderiza os boards visíveis para o usuário atual
  const renderVisibleBoards = (size: 'sm' | 'md' = 'sm') => {
    if (!user?.role) return null;

    return visibleBoards
      .filter(board => userCanViewBoard(board.slug))
      .filter(board => {
        // Se usuário é gestor_ads e tem rota especial, não duplicar o board de ads
        if (userSpecialRoute && user.role === 'gestor_ads' && isAdsBoard(board)) {
          return false;
        }
        return true;
      })
      .map(board => (
        <BoardLink key={board.id} board={board} size={size} />
      ));
  };

  // Ícones com cores por departamento
  const getDepartmentColor = (role: string) => {
    if (role === 'comercial' || role.includes('comercial')) return 'text-success';
    if (role === 'gestor_ads' || role.includes('ads')) return 'text-info';
    if (role === 'design' || role.includes('design')) return 'text-purple';
    if (role === 'video' || role.includes('video')) return 'text-pink-400';
    return 'text-sidebar-foreground';
  };

  return (
    <aside 
      className={cn(
        "h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 sticky top-0",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!isCollapsed && (
          <img src={logo} alt="Millennials B2B" className="h-8" />
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-elegant p-4 space-y-2">
        
        {/* ========== SEÇÃO CEO ========== */}
        {isCEO && (
          <div className="space-y-1.5 pb-6 border-b border-sidebar-border/30">
            {!isCollapsed && (
              <span className="px-4 py-2.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wide block">
                Strategic Vision
              </span>
            )}
            <NavLink to="/ceo" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
              <Crown size={20} />
              {!isCollapsed && <span>Indicadores</span>}
            </NavLink>
            {ceoBoard && (
              <NavLink to="/kanban/ceo" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
                <Kanban size={20} />
                {!isCollapsed && <span>Kanban CEO</span>}
              </NavLink>
            )}
            <NavLink to="/okrs-millennials" className={({ isActive }) => cn("sidebar-item bg-gradient-to-r from-primary/20 to-transparent border-l-2 border-primary", isActive && "active")}>
              <Target size={20} />
              {!isCollapsed && <span>OKRs Millennials</span>}
            </NavLink>
            <NavLink to="/tv-dashboard" className={({ isActive }) => cn("sidebar-item bg-gradient-to-r from-amber-500/20 to-transparent border-l-2 border-amber-500", isActive && "active")}>
              <LayoutDashboard size={20} />
              {!isCollapsed && <span>TV Dashboard</span>}
            </NavLink>
            {!isCollapsed && <div className="sidebar-section-divider" />}
          </div>
        )}

        {/* ========== SEÇÃO GESTOR DE PROJETOS / SUCESSO CLIENTE ========== */}
        {(isAdminUser || user?.role === 'sucesso_cliente') && !isCEO && (
          <div className="space-y-1.5 pb-6 border-b border-sidebar-border/30">
            {!isCollapsed && (
              <span className="px-4 py-2.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
                Management
              </span>
            )}
            <NavLink to="/kanban/cadastro-novos-clientes" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
              <UserPlus size={20} />
              {!isCollapsed && <span>Cadastrar Cliente</span>}
            </NavLink>
            <NavLink to="/admin/usuarios" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
              <Users size={20} />
              {!isCollapsed && <span>Usuários</span>}
            </NavLink>
            {isAdminUser && (
              <NavLink to="/admin/grupos" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
                <Building2 size={20} />
                {!isCollapsed && <span>Grupos</span>}
              </NavLink>
            )}
          </div>
        )}

        {/* ========== CATEGORIAS DE PRODUTOS (CEO ONLY) ========== */}
        {isCEO && productCategories.length > 0 && !isCollapsed && (
          <div className="space-y-1.5 pb-6 border-b border-sidebar-border/30">
            <span className="px-4 py-2.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
              Products
            </span>
            {productCategories.map(productCategory => {
              const CategoryIcon = productCategoryIcons[productCategory.icon || ''] || Package;
              
              return (
                <Collapsible
                  key={productCategory.id}
                  open={openProductCategories[productCategory.id]}
                  onOpenChange={() => toggleProductCategory(productCategory.id)}
                >
                  <CollapsibleTrigger className="sidebar-item w-full justify-between">
                    <div className="flex items-center gap-3">
                      <CategoryIcon size={20} />
                      <span>{productCategory.name}</span>
                    </div>
                    <ChevronDown 
                      size={16} 
                      className={cn("transition-transform duration-200", openProductCategories[productCategory.id] && "rotate-180")} 
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 space-y-1 mt-1">
                    {/* Subcategorias dentro da categoria principal */}
                    {productCategory.subcategories.map(subcategory => {
                      const SubcategoryIcon = productCategoryIcons[subcategory.icon || ''] || TrendingUp;
                      const hasGroups = subcategory.groups.length > 0;
                      const hasBoards = subcategory.boards && subcategory.boards.length > 0;
                      
                      // Se a subcategoria tem apenas boards (sem grupos), renderiza como collapsible com Dashboard + Clientes
                      if (!hasGroups && hasBoards) {
                        const board = subcategory.boards[0];
                        return (
                          <Collapsible
                            key={subcategory.id}
                            open={openProductCategories[`simple_${subcategory.id}`]}
                            onOpenChange={() => toggleProductCategory(`simple_${subcategory.id}`)}
                          >
                            <CollapsibleTrigger className="sidebar-item w-full text-sm py-1.5 justify-between">
                              <div className="flex items-center gap-2">
                                <SubcategoryIcon size={16} />
                                <span>{subcategory.name}</span>
                              </div>
                              <ChevronDown 
                                size={14} 
                                className={cn("transition-transform duration-200", openProductCategories[`simple_${subcategory.id}`] && "rotate-180")} 
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-4 space-y-1 mt-1">
                              {/* Dashboard Link - Premium Style (Violet) */}
                              <NavLink
                                to={`/produto/${board.slug}`}
                                className={({ isActive }) => cn(
                                  "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-all duration-300 font-medium",
                                  "bg-gradient-to-r from-violet-500/15 via-purple-500/10 to-transparent",
                                  "border-l-2 border-violet-500/60",
                                  "hover:from-violet-500/25 hover:via-purple-500/15 hover:to-violet-500/5",
                                  "hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]",
                                  isActive 
                                    ? "bg-violet-500/20 text-violet-300 border-l-2 border-violet-400" 
                                    : "text-violet-400 hover:text-violet-300"
                                )}
                              >
                                <LayoutDashboard size={12} className="text-violet-400" />
                                <span className="truncate">Dashboard</span>
                              </NavLink>
                              {/* Link para Kanban do produto */}
                              <NavLink
                                to={`/kanban/${board.slug}`}
                                className={({ isActive }) => cn(
                                  "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                                  isActive 
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                )}
                              >
                                <Kanban size={12} />
                                <span className="truncate">Kanban</span>
                              </NavLink>
                              {/* Link para Lista de Clientes do produto */}
                              <NavLink
                                to={`/clientes/${board.slug}`}
                                className={({ isActive }) => cn(
                                  "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                                  isActive 
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                )}
                              >
                                <List size={12} />
                                <span className="truncate">Clientes</span>
                              </NavLink>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      }
                      
                      // Se tem grupos, renderiza como collapsible (como antes - Millennials Growth)
                      return (
                        <Collapsible
                          key={subcategory.id}
                          open={openProductCategories[subcategory.id]}
                          onOpenChange={() => toggleProductCategory(subcategory.id)}
                        >
                          <CollapsibleTrigger className="sidebar-item w-full text-sm py-1.5 justify-between">
                            <div className="flex items-center gap-2">
                              <SubcategoryIcon size={16} />
                              <span>{subcategory.name}</span>
                            </div>
                            <ChevronDown 
                              size={14} 
                              className={cn("transition-transform duration-200", openProductCategories[subcategory.id] && "rotate-180")} 
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-4 space-y-1 mt-1">
                            {/* Link do Dashboard - Premium Style (Violet) for ALL subcategories with groups */}
                            <NavLink
                              to={subcategory.name === 'Millennials Growth' ? '/millennials-growth' : `/produto/${subcategory.name.toLowerCase().replace(/\s+/g, '-')}`}
                              className={({ isActive }) => cn(
                                "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-all duration-300 font-medium",
                                "bg-gradient-to-r from-violet-500/15 via-purple-500/10 to-transparent",
                                "border-l-2 border-violet-500/60",
                                "hover:from-violet-500/25 hover:via-purple-500/15 hover:to-violet-500/5",
                                "hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]",
                                isActive 
                                  ? "bg-violet-500/20 text-violet-300 border-l-2 border-violet-400" 
                                  : "text-violet-400 hover:text-violet-300"
                              )}
                            >
                              <LayoutDashboard size={12} className="text-violet-400" />
                              <span className="truncate">Dashboard</span>
                            </NavLink>
                            {/* Link para Lista de Clientes */}
                            <NavLink
                              to={subcategory.name === 'Millennials Growth' ? '/clientes/millennials-growth' : `/clientes/${subcategory.name.toLowerCase().replace(/\s+/g, '-')}`}
                              className={({ isActive }) => cn(
                                "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                                isActive 
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                              )}
                            >
                              <List size={12} />
                              <span className="truncate">Clientes</span>
                            </NavLink>
                            
                            {/* Grupos dentro da subcategoria */}
                            {subcategory.groups.map(group => (
                              <Collapsible
                                key={group.id}
                                open={openGroups[group.id]}
                                onOpenChange={() => toggleGroup(group.id)}
                              >
                                <CollapsibleTrigger className="sidebar-item w-full text-xs py-1.5 justify-between">
                                  <div className="flex items-center gap-2">
                                    <Building2 size={14} />
                                    <span>{group.name}</span>
                                  </div>
                                  <ChevronDown 
                                    size={12} 
                                    className={cn("transition-transform duration-200", openGroups[group.id] && "rotate-180")} 
                                  />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                                  {/* Coringas */}
                                  {getCoringaRoles(group.id).length > 0 && (
                                    <div className="pl-2 border-l-2 border-sidebar-border space-y-1">
                                      <span className="px-2 text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-wider">
                                        Coringas
                                      </span>
                                      {getCoringaRoles(group.id).map(role => (
                                        <NavLink
                                          key={role}
                                          to={getRoleKanbanPath(role)}
                                          className={() => cn(
                                            "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                                            isRoleActive(role)
                                              ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                          )}
                                        >
                                          <User size={12} />
                                          <span className="truncate">{ROLE_LABELS[role]}</span>
                                        </NavLink>
                                      ))}
                                    </div>
                                  )}

                                  {/* Squads */}
                                  {group.squads.map(squad => {
                                    const squadRoles = getSquadRoles(squad.id);
                                    const nonAdsRoles = squadRoles.filter(role => role !== 'gestor_ads');
                                    const squadAdsBoards = adsManagerBoards.filter(b => b.squad_id === squad.id);
                                    
                                    return (
                                      <Collapsible 
                                        key={squad.id}
                                        open={openSquads[squad.id]}
                                        onOpenChange={() => toggleSquad(squad.id)}
                                      >
                                        <CollapsibleTrigger className="sidebar-item w-full text-xs py-1.5 justify-between">
                                          <div className="flex items-center gap-2">
                                            <Briefcase size={14} />
                                            <span>{squad.name}</span>
                                          </div>
                                          <ChevronDown 
                                            size={12} 
                                            className={cn("transition-transform duration-200", openSquads[squad.id] && "rotate-180")} 
                                          />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pl-4 space-y-0.5">
                                          {squadAdsBoards.map(adsBoard => (
                                            <NavLink
                                              key={adsBoard.id}
                                              to={`/gestor-ads/${adsBoard.owner_user_id}`}
                                              className={({ isActive }) => cn(
                                                "flex items-center gap-2 px-2 py-1 text-[10px] rounded-lg transition-colors",
                                                isActive 
                                                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                              )}
                                            >
                                              <Target size={10} />
                                              <span className="truncate">ADS ({adsBoard.owner_name})</span>
                                            </NavLink>
                                          ))}
                                          
                                          {nonAdsRoles.map(role => (
                                            <NavLink
                                              key={role}
                                              to={getRoleKanbanPath(role)}
                                              className={() => cn(
                                                "flex items-center gap-2 px-2 py-1 text-[10px] rounded-lg transition-colors",
                                                isRoleActive(role)
                                                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                              )}
                                            >
                                              <User size={10} />
                                              <span className="truncate">{ROLE_LABELS[role]}</span>
                                            </NavLink>
                                          ))}
                                          
                                          {squadAdsBoards.length === 0 && nonAdsRoles.length === 0 && (
                                            <span className="px-2 text-[10px] text-sidebar-foreground/40 italic">
                                              Sem usuários
                                            </span>
                                          )}
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  })}
                                  
                                  {group.squads.length === 0 && getCoringaRoles(group.id).length === 0 && (
                                    <span className="px-2 text-[10px] text-sidebar-foreground/40 italic">
                                      Grupo vazio
                                    </span>
                                  )}
                                </CollapsibleContent>
                              </Collapsible>
                            ))}
                            
                            {subcategory.groups.length === 0 && (!subcategory.boards || subcategory.boards.length === 0) && (
                              <span className="px-2 text-xs text-sidebar-foreground/40 italic">
                                Nenhum grupo
                              </span>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    
                    {/* Grupos diretamente na categoria principal (sem subcategoria) */}
                    {productCategory.groups.map(group => (
                      <Collapsible
                        key={group.id}
                        open={openGroups[group.id]}
                        onOpenChange={() => toggleGroup(group.id)}
                      >
                        <CollapsibleTrigger className="sidebar-item w-full text-sm py-1.5 justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} />
                            <span>{group.name}</span>
                          </div>
                          <ChevronDown 
                            size={14} 
                            className={cn("transition-transform duration-200", openGroups[group.id] && "rotate-180")} 
                          />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 space-y-1 mt-1">
                          {/* Coringas */}
                          {getCoringaRoles(group.id).length > 0 && (
                            <div className="pl-2 border-l-2 border-sidebar-border space-y-1">
                              <span className="px-2 text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-wider">
                                Coringas
                              </span>
                              {getCoringaRoles(group.id).map(role => (
                                <NavLink
                                  key={role}
                                  to={getRoleKanbanPath(role)}
                                  className={() => cn(
                                    "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                                    isRoleActive(role)
                                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                  )}
                                >
                                  <User size={12} />
                                  <span className="truncate">{ROLE_LABELS[role]}</span>
                                </NavLink>
                              ))}
                            </div>
                          )}

                          {/* Squads */}
                          {group.squads.map(squad => {
                            const squadRoles = getSquadRoles(squad.id);
                            const nonAdsRoles = squadRoles.filter(role => role !== 'gestor_ads');
                            const squadAdsBoards = adsManagerBoards.filter(b => b.squad_id === squad.id);
                            
                            return (
                              <Collapsible 
                                key={squad.id}
                                open={openSquads[squad.id]}
                                onOpenChange={() => toggleSquad(squad.id)}
                              >
                                <CollapsibleTrigger className="sidebar-item w-full text-xs py-1.5 justify-between">
                                  <div className="flex items-center gap-2">
                                    <Briefcase size={14} />
                                    <span>{squad.name}</span>
                                  </div>
                                  <ChevronDown 
                                    size={12} 
                                    className={cn("transition-transform duration-200", openSquads[squad.id] && "rotate-180")} 
                                  />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pl-4 space-y-0.5">
                                  {squadAdsBoards.map(adsBoard => (
                                    <NavLink
                                      key={adsBoard.id}
                                      to={`/gestor-ads/${adsBoard.owner_user_id}`}
                                      className={({ isActive }) => cn(
                                        "flex items-center gap-2 px-2 py-1 text-[10px] rounded-lg transition-colors",
                                        isActive 
                                          ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                      )}
                                    >
                                      <Target size={10} />
                                      <span className="truncate">ADS ({adsBoard.owner_name})</span>
                                    </NavLink>
                                  ))}
                                  
                                  {nonAdsRoles.map(role => (
                                    <NavLink
                                      key={role}
                                      to={getRoleKanbanPath(role)}
                                      className={() => cn(
                                        "flex items-center gap-2 px-2 py-1 text-[10px] rounded-lg transition-colors",
                                        isRoleActive(role)
                                          ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                      )}
                                    >
                                      <User size={10} />
                                      <span className="truncate">{ROLE_LABELS[role]}</span>
                                    </NavLink>
                                  ))}
                                  
                                  {squadAdsBoards.length === 0 && nonAdsRoles.length === 0 && (
                                    <span className="px-2 text-[10px] text-sidebar-foreground/40 italic">
                                      Sem usuários
                                    </span>
                                  )}
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                          
                          {group.squads.length === 0 && getCoringaRoles(group.id).length === 0 && (
                            <span className="px-2 text-xs text-sidebar-foreground/40 italic">
                              Grupo vazio
                            </span>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                    
                    {productCategory.groups.length === 0 && productCategory.subcategories.length === 0 && (
                      <span className="px-2 text-xs text-sidebar-foreground/40 italic">
                        Nenhum item
                      </span>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* ========== GRUPOS (GESTOR DE PROJETOS VIEW) ========== */}
        {isAdminUser && !isCEO && visibleGroups.length > 0 && !isCollapsed && (
          <div className="space-y-1.5 pb-6 border-b border-sidebar-border/30">
            <span className="px-4 py-2.5 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
              My Group
            </span>
            
            {visibleGroups.map(group => (
              <Collapsible
                key={group.id}
                open={openGroups[group.id]}
                onOpenChange={() => toggleGroup(group.id)}
              >
                <CollapsibleTrigger className="sidebar-item w-full justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 size={20} />
                    <span>{group.name}</span>
                  </div>
                  <ChevronDown 
                    size={16} 
                    className={cn("transition-transform duration-200", openGroups[group.id] && "rotate-180")} 
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-1">
                  {/* Coringas */}
                  {getCoringaRoles(group.id).length > 0 && (
                    <div className="pl-2 border-l-2 border-sidebar-border space-y-1">
                      <span className="px-2 text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-wider">
                        Coringas
                      </span>
                      {getCoringaRoles(group.id).map(role => (
                        <NavLink
                          key={role}
                          to={getRoleKanbanPath(role)}
                          className={() => cn(
                            "flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                            isRoleActive(role)
                              ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                        >
                          <User size={14} />
                          <span className="truncate">{ROLE_LABELS[role]}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}

                  {/* Squads */}
                  {group.squads.map(squad => {
                    const squadRoles = getSquadRoles(squad.id);
                    const nonAdsRoles = squadRoles.filter(role => role !== 'gestor_ads');
                    const squadAdsBoards = adsManagerBoards.filter(b => b.squad_id === squad.id);
                    
                    return (
                      <Collapsible 
                        key={squad.id}
                        open={openSquads[squad.id]}
                        onOpenChange={() => toggleSquad(squad.id)}
                      >
                        <CollapsibleTrigger className="sidebar-item w-full text-sm py-1.5 justify-between">
                          <div className="flex items-center gap-2">
                            <Briefcase size={16} />
                            <span>{squad.name}</span>
                          </div>
                          <ChevronDown 
                            size={14} 
                            className={cn("transition-transform duration-200", openSquads[squad.id] && "rotate-180")} 
                          />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-6 space-y-0.5">
                          {squadAdsBoards.map(adsBoard => (
                            <NavLink
                              key={adsBoard.id}
                              to={`/gestor-ads/${adsBoard.owner_user_id}`}
                              className={({ isActive }) => cn(
                                "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                                isActive 
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                              )}
                            >
                              <Target size={12} />
                              <span className="truncate">Gestor de ADS ({adsBoard.owner_name})</span>
                            </NavLink>
                          ))}
                          
                          {nonAdsRoles.map(role => (
                            <NavLink
                              key={role}
                              to={getRoleKanbanPath(role)}
                              className={() => cn(
                                "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                                isRoleActive(role)
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                              )}
                            >
                              <User size={12} />
                              <span className="truncate">{ROLE_LABELS[role]}</span>
                            </NavLink>
                          ))}
                          
                          {squadAdsBoards.length === 0 && nonAdsRoles.length === 0 && (
                            <span className="px-2 text-xs text-sidebar-foreground/40 italic">
                              Sem usuários
                            </span>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* ========== MINHA ORGANIZAÇÃO (USUÁRIO OPERACIONAL) ========== */}
        {!isAdminUser && userGroup && !isCollapsed && (
          <div className="space-y-1">
            <span className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
              Minha Organização
            </span>
            
            <Collapsible
              open={openGroups[userGroup.id] ?? true}
              onOpenChange={() => toggleGroup(userGroup.id)}
            >
              <CollapsibleTrigger className="sidebar-item w-full justify-between">
                <div className="flex items-center gap-3">
                  <Building2 size={20} />
                  <span>{userGroup.name}</span>
                </div>
                <ChevronDown 
                  size={16} 
                  className={cn("transition-transform duration-200", (openGroups[userGroup.id] ?? true) && "rotate-180")} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 mt-1">
                {/* Com Squad */}
                {userSquad && (
                  <Collapsible
                    open={openSquads[userSquad.id] ?? true}
                    onOpenChange={() => toggleSquad(userSquad.id)}
                  >
                    <CollapsibleTrigger className="sidebar-item w-full text-sm py-1.5 justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} />
                        <span>{userSquad.name}</span>
                      </div>
                      <ChevronDown 
                        size={14} 
                        className={cn("transition-transform duration-200", (openSquads[userSquad.id] ?? true) && "rotate-180")} 
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-0.5">
                      {/* Rota especial (ex: Gestor de Ads PRO+) */}
                      {userSpecialRoute && (
                        <NavLink
                          to={userSpecialRoute.path}
                          className={({ isActive }) => cn(
                            "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors",
                            isActive 
                              ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                        >
                          <userSpecialRoute.icon size={12} />
                          <span className="truncate">{userSpecialRoute.label}</span>
                        </NavLink>
                      )}
                      {/* Boards visíveis */}
                      {renderVisibleBoards('sm')}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Sem Squad (no grupo direto) */}
                {!userSquad && (
                  <div className="space-y-0.5">
                    {userSpecialRoute && (
                      <NavLink
                        to={userSpecialRoute.path}
                        className={({ isActive }) => cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <userSpecialRoute.icon size={14} />
                        <span className="truncate">{userSpecialRoute.label}</span>
                      </NavLink>
                    )}
                    {renderVisibleBoards('md')}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* ========== MINHA ÁREA (FALLBACK SEM GRUPO) ========== */}
        {!isAdminUser && !userGroup && !isCollapsed && (userSpecialRoute || user?.role) && (
          <div className="space-y-1">
            <span className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
              Minha Área
            </span>

            {userSpecialRoute && (
              <NavLink
                to={userSpecialRoute.path}
                className={({ isActive }) => cn("sidebar-item", isActive && "active")}
              >
                <userSpecialRoute.icon size={20} />
                <span>{userSpecialRoute.label}</span>
              </NavLink>
            )}

            {visibleBoards
              .filter(board => userCanViewBoard(board.slug))
              .map(board => {
                const path = getBoardPath(board);
                const label = getBoardLabel(board);
                const IconComponent = isAdsBoard(board) ? Target : Kanban;

                return (
                  <NavLink
                    key={board.id}
                    to={path}
                    className={({ isActive }) => cn("sidebar-item", isActive && "active")}
                  >
                    <IconComponent size={20} />
                    <span>{label}</span>
                  </NavLink>
                );
              })}
          </div>
        )}

        {/* ========== VENDAS ========== */}
        {user?.role && (isAdminUser || user?.role === 'sucesso_cliente' || user?.role === 'financeiro') && !isCollapsed && (
          <div className="space-y-1 pb-2">
            <div className="sidebar-section-divider" />
            <span className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider block">
              Vendas
            </span>
            
            {/* UP Sells - visível para CS, CEO e Gestor de Projetos */}
            {(isAdminUser || user?.role === 'sucesso_cliente') && (
              <NavLink
                to="/upsells"
                className={({ isActive }) => cn("sidebar-item", isActive && "active")}
              >
                <TrendingUp size={20} />
                <span>UP Sells</span>
              </NavLink>
            )}
            
            {/* Comissões - visível para Financeiro, CEO e Gestor de Projetos */}
            {(isAdminUser || user?.role === 'financeiro') && (
              <NavLink
                to="/comissoes"
                className={({ isActive }) => cn("sidebar-item", isActive && "active")}
              >
                <Coins size={20} />
                <span>Comissões</span>
              </NavLink>
            )}
          </div>
        )}

        {/* ========== TREINAMENTOS ========== */}
        {user?.role && !isCollapsed && (
          <div className="space-y-1 pb-2">
            <div className="sidebar-section-divider" />
            <span className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider block">
              Treinamento
            </span>
            <NavLink
              to="/treinamentos"
              className={({ isActive }) => cn("sidebar-item", isActive && "active")}
            >
              <GraduationCap size={20} />
              <span>Treinamentos Millennials</span>
            </NavLink>
          </div>
        )}

        {/* ========== ADMINISTRATIVO ========== */}
        {user?.role && !isCollapsed && (
          <div className="space-y-1 pb-3">
            <div className="sidebar-section-divider" />
            <span className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider block">
              Administrativo
            </span>
            {visibleCategories.map(category => {
              const IconComponent = categoryIcons[category.icon || ''] || Folder;
              const categoryBoard = category.boards[0];
              
              if (!categoryBoard) return null;

              // Financeiro como dropdown com subitens
              if (categoryBoard.slug === 'financeiro' || categoryBoard.slug === 'financeiro-board') {
                const isFinanceiroActive = currentPath.startsWith('/financeiro');
                
                return (
                  <Collapsible
                    key={category.id}
                    open={openProductCategories['financeiro']}
                    onOpenChange={() => toggleProductCategory('financeiro')}
                  >
                    <CollapsibleTrigger 
                      className={cn(
                        "sidebar-item w-full justify-between",
                        isFinanceiroActive && "active"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent size={20} />
                        <span>{category.name}</span>
                      </div>
                      <ChevronDown 
                        size={16} 
                        className={cn("transition-transform duration-200", openProductCategories['financeiro'] && "rotate-180")} 
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-0.5 mt-1">
                      {/* Dashboard Financeiro */}
                      <NavLink
                        to="/financeiro-dashboard"
                        className={({ isActive }) => cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <LayoutDashboard size={14} />
                        <span className="truncate">Dashboard</span>
                      </NavLink>
                      <NavLink
                        to="/financeiro?tab=contratos"
                        className={() => cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                          currentPath === '/financeiro' && (new URLSearchParams(location.search).get('tab') === 'contratos' || !new URLSearchParams(location.search).get('tab'))
                            ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <Folder size={14} />
                        <span className="truncate">Millennials Contratos</span>
                      </NavLink>
                      <NavLink
                        to="/financeiro?tab=contas"
                        className={() => cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                          currentPath === '/financeiro' && new URLSearchParams(location.search).get('tab') === 'contas'
                            ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <Wallet size={14} />
                        <span className="truncate">Contas a Pagar e Receber</span>
                      </NavLink>
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              // RH como dropdown com subitens (Contratação e Jornada Equipe)
              if (categoryBoard.slug === 'rh' || categoryBoard.slug === 'rh-board') {
                const isRHActive = currentPath.startsWith('/rh');
                
                return (
                  <Collapsible
                    key={category.id}
                    open={openProductCategories['rh']}
                    onOpenChange={() => toggleProductCategory('rh')}
                  >
                    <CollapsibleTrigger 
                      className={cn(
                        "sidebar-item w-full justify-between",
                        isRHActive && "active"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent size={20} />
                        <span>{category.name}</span>
                      </div>
                      <ChevronDown 
                        size={16} 
                        className={cn("transition-transform duration-200", openProductCategories['rh'] && "rotate-180")} 
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-0.5 mt-1">
                      <NavLink
                        to="/rh/contratacao"
                        className={() => cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                          (currentPath === '/rh' || currentPath === '/rh/contratacao')
                            ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <UserPlus size={14} />
                        <span className="truncate">Contratação</span>
                      </NavLink>
                      <NavLink
                        to="/rh/jornada-equipe"
                        className={({ isActive }) => cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <Users size={14} />
                        <span className="truncate">Jornada Equipe</span>
                      </NavLink>
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              // Default path for other categories
              const targetPath = `/kanban/${categoryBoard.slug}`;
              const isActive = isPathActive(currentPath, targetPath);

              return (
                <NavLink
                  key={category.id}
                  to={targetPath}
                  className={() => cn("sidebar-item", isActive && "active")}
                >
                  <IconComponent size={20} />
                  <span>{category.name}</span>
                </NavLink>
              );
            })}
          </div>
        )}

        {/* ========== ADMINISTRAÇÃO (CEO) ========== */}
        {isCEO && (
          <div className="space-y-1 pb-3">
            {!isCollapsed && (
              <>
                <div className="sidebar-section-divider" />
                <span className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider block">
                  Configs Sistema
                </span>
              </>
            )}
            <NavLink to="/admin/usuarios" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
              <Users size={20} />
              {!isCollapsed && <span>Usuários</span>}
            </NavLink>
            <NavLink to="/admin/grupos" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
              <Building2 size={20} />
              {!isCollapsed && <span>Grupos</span>}
            </NavLink>
            <NavLink to="/admin/configuracoes" className={({ isActive }) => cn("sidebar-item", isActive && "active")}>
              <Settings size={20} />
              {!isCollapsed && <span>Configurações</span>}
            </NavLink>
          </div>
        )}
      </nav>

      {/* User Info */}
      {user && (
        <div className={cn("p-4 border-t border-sidebar-border", isCollapsed ? "flex justify-center" : "")}>
          <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-display font-bold">
              {user.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user.name}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
