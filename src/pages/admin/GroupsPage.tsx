import { useState, useMemo } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useGroupsWithOccupancy, 
  useCreateGroup, 
  useDeleteGroup, 
  useCreateSquad, 
  useDeleteSquad,
  useUpdateGroup,
  GroupWithOccupancy 
} from '@/hooks/useGroupManagement';
import { useUsers, DbUser } from '@/hooks/useUsers';
import { UserRole, ROLE_LABELS } from '@/types/auth';
import { 
  Plus, 
  Trash2, 
  Users, 
  Building2, 
  Briefcase, 
  Loader2, 
  Edit2,
  ChevronDown,
  ChevronRight,
  X,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const AVAILABLE_ROLES: UserRole[] = [
  'gestor_projetos',
  'gestor_ads',
  'sucesso_cliente',
  'design',
  'editor_video',
  'devs',
  'atrizes_gravacao',
  'produtora',
  'gestor_crm',
  'consultor_comercial',
];

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; roleLimits: { role: UserRole; max_count: number }[] }) => void;
  isLoading: boolean;
}

function CreateGroupModal({ isOpen, onClose, onSubmit, isLoading }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [roleLimits, setRoleLimits] = useState<Record<UserRole, number>>(
    AVAILABLE_ROLES.reduce((acc, role) => ({ ...acc, [role]: 1 }), {} as Record<UserRole, number>)
  );

  // Reset form when modal is opened
  const resetForm = () => {
    setName('');
    setRoleLimits(
      AVAILABLE_ROLES.reduce((acc, role) => ({ ...acc, [role]: 1 }), {} as Record<UserRole, number>)
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const limits = Object.entries(roleLimits)
      .filter(([_, max]) => max > 0)
      .map(([role, max_count]) => ({ role: role as UserRole, max_count }));
    
    onSubmit({ name, roleLimits: limits });
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl border border-border max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-bold uppercase">Novo Grupo</h2>
          <button onClick={handleClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Nome do Grupo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Grupo 3"
              className="input-apple"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-medium">Limite de Vagas por Cargo</label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {AVAILABLE_ROLES.map(role => (
                <div key={role} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-sm">{ROLE_LABELS[role]}</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={roleLimits[role]}
                    onChange={(e) => setRoleLimits(prev => ({ ...prev, [role]: parseInt(e.target.value) || 0 }))}
                    className="w-16 px-3 py-1.5 rounded-lg bg-background border border-border text-center text-sm"
                    disabled={isLoading}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-xl text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              Criar Grupo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CreateSquadModalProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSubmit: (data: { name: string; group_id: string }) => void;
  isLoading: boolean;
}

function CreateSquadModal({ isOpen, groupId, groupName, onClose, onSubmit, isLoading }: CreateSquadModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name, group_id: groupId });
    setName('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-bold uppercase">Novo Squad</h2>
            <p className="text-sm text-muted-foreground">em {groupName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Nome do Squad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Squad 3"
              className="input-apple"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-muted-foreground hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              Criar Squad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GroupCard({ group, users, onAddSquad, onDeleteGroup, onDeleteSquad, canManage = true }: {
  group: GroupWithOccupancy;
  users: DbUser[];
  onAddSquad: (groupId: string, groupName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteSquad: (squadId: string) => void;
  canManage?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSquads, setExpandedSquads] = useState<Set<string>>(new Set());

  // Filter users that belong to this group
  const groupUsers = users.filter(u => u.group_id === group.id);
  const coringaUsers = groupUsers.filter(u => u.is_coringa);

  const toggleSquad = (squadId: string) => {
    setExpandedSquads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(squadId)) {
        newSet.delete(squadId);
      } else {
        newSet.add(squadId);
      }
      return newSet;
    });
  };

  const getSquadUsers = (squadId: string) => {
    return groupUsers.filter(u => u.squad_id === squadId);
  };

  return (
    <div className="card-apple overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full p-5 flex items-center justify-between hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="text-primary" size={24} />
            </div>
            <div className="text-left">
              <h3 className="font-display text-lg font-bold">{group.name}</h3>
              <p className="text-sm text-muted-foreground">
                {group.totalMembers} membros • {group.squads.length} squads
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
                className="p-2 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            )}
            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-5 pb-5 space-y-4">
            {/* Role Occupancy */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Ocupação por Cargo
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {group.roleOccupancy.map(ro => (
                  <div
                    key={ro.role}
                    className={cn(
                      "p-3 rounded-xl text-sm",
                      ro.current >= ro.max 
                        ? "bg-danger/10 border border-danger/30" 
                        : "bg-muted/50"
                    )}
                  >
                    <div className="font-medium truncate">{ro.label}</div>
                    <div className={cn(
                      "text-lg font-bold",
                      ro.current >= ro.max ? "text-danger" : "text-foreground"
                    )}>
                      {ro.current}/{ro.max}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coringas */}
            {coringaUsers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Coringas (atuam em múltiplos squads)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {coringaUsers.map(user => (
                    <div 
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20"
                    >
                      <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center text-warning font-semibold text-sm">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          user.name.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{ROLE_LABELS[user.role]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Squads */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Squads
                </h4>
                {canManage && (
                  <button
                    onClick={() => onAddSquad(group.id, group.name)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={14} />
                    Adicionar Squad
                  </button>
                )}
              </div>
              
              {group.squads.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">Nenhum squad criado</p>
              ) : (
                <div className="space-y-2">
                  {group.squads.map(squad => {
                    const squadUsers = getSquadUsers(squad.id);
                    const isExpanded = expandedSquads.has(squad.id);
                    
                    return (
                      <div key={squad.id} className="rounded-xl border border-border overflow-hidden">
                        <div 
                          className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => toggleSquad(squad.id)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown size={16} className="text-muted-foreground" />
                            ) : (
                              <ChevronRight size={16} className="text-muted-foreground" />
                            )}
                            <Briefcase size={18} className="text-muted-foreground" />
                            <div>
                              <span className="font-medium">{squad.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({squadUsers.length} membros)
                              </span>
                            </div>
                          </div>
                          {canManage && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteSquad(squad.id); }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        
                        {/* Squad Members */}
                        {isExpanded && (
                          <div className="p-3 bg-background border-t border-border">
                            {squadUsers.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic text-center py-2">
                                Nenhum membro neste squad
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {squadUsers.map(user => (
                                  <div 
                                    key={user.id}
                                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold text-sm">
                                      {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                                      ) : (
                                        user.name.charAt(0)
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">{user.name}</p>
                                      <p className="text-xs text-muted-foreground truncate">{ROLE_LABELS[user.role]}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function GroupsPage() {
  const { user, isAdminUser, isCEO, userGroupId } = useAuth();
  const { data: groups = [], isLoading, error } = useGroupsWithOccupancy();
  const { data: users = [] } = useUsers();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();
  const createSquad = useCreateSquad();
  const deleteSquad = useDeleteSquad();

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [squadModal, setSquadModal] = useState<{ groupId: string; groupName: string } | null>(null);

  // CEO e Gestor de Projetos podem acessar
  if (!isAdminUser) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h2 className="font-display text-xl font-bold">Acesso Restrito</h2>
            <p className="text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Filtrar grupos: CEO vê todos, Gestor de Projetos vê apenas seu grupo
  const visibleGroups = isCEO 
    ? groups 
    : groups.filter(g => g.id === userGroupId);

  const handleCreateGroup = async (data: { name: string; roleLimits: { role: UserRole; max_count: number }[] }) => {
    try {
      await createGroup.mutateAsync(data);
      setIsCreateGroupOpen(false);
      toast.success('Grupo criado com sucesso!');
    } catch (err) {
      toast.error('Erro ao criar grupo', { description: err instanceof Error ? err.message : 'Tente novamente' });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Tem certeza que deseja excluir este grupo? Todos os squads, usuários do grupo e limites serão removidos.')) return;
    try {
      await deleteGroup.mutateAsync({ groupId, deleteUsers: true });
      toast.success('Grupo e usuários removidos');
    } catch (err) {
      toast.error('Erro ao remover grupo', { description: err instanceof Error ? err.message : 'Tente novamente' });
    }
  };

  const handleCreateSquad = async (data: { name: string; group_id: string }) => {
    try {
      await createSquad.mutateAsync(data);
      setSquadModal(null);
      toast.success('Squad criado com sucesso!');
    } catch (err) {
      toast.error('Erro ao criar squad');
    }
  };

  const handleDeleteSquad = async (squadId: string) => {
    if (!confirm('Tem certeza que deseja excluir este squad?')) return;
    try {
      await deleteSquad.mutateAsync(squadId);
      toast.success('Squad removido');
    } catch (err) {
      toast.error('Erro ao remover squad');
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
              Gestão de Grupos
            </h1>
            <p className="text-muted-foreground mt-1">
              {visibleGroups.length} {visibleGroups.length === 1 ? 'grupo' : 'grupos'} {!isCEO && '(seu grupo)'}
            </p>
          </div>
          
          {/* Apenas CEO pode criar novos grupos */}
          {isCEO && (
            <button
              onClick={() => setIsCreateGroupOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-semibold uppercase text-sm hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Plus size={18} />
              Novo Grupo
            </button>
          )}
        </div>

        {/* Groups List */}
        <div className="space-y-4">
          {visibleGroups.length === 0 ? (
            <div className="card-apple p-12 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-lg font-bold">
                {isCEO ? 'Nenhum grupo criado' : 'Você não pertence a nenhum grupo'}
              </h3>
              <p className="text-muted-foreground mt-1">
                {isCEO ? 'Crie seu primeiro grupo para organizar os usuários.' : 'Entre em contato com o CEO para ser adicionado a um grupo.'}
              </p>
            </div>
          ) : (
            visibleGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                users={users}
                onAddSquad={(id, name) => setSquadModal({ groupId: id, groupName: name })}
                onDeleteGroup={isCEO ? handleDeleteGroup : () => {}}
                onDeleteSquad={isCEO ? handleDeleteSquad : () => {}}
                canManage={isCEO}
              />
            ))
          )}
        </div>

        {/* Info Card */}
        <div className="card-apple p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Nota:</strong> O limite de vagas define quantas pessoas de cada cargo
            podem fazer parte do grupo. Quando um cargo atinge o limite, não será possível adicionar mais membros
            com esse cargo ao grupo.
          </p>
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSubmit={handleCreateGroup}
        isLoading={createGroup.isPending}
      />

      {/* Create Squad Modal */}
      {squadModal && (
        <CreateSquadModal
          isOpen={true}
          groupId={squadModal.groupId}
          groupName={squadModal.groupName}
          onClose={() => setSquadModal(null)}
          onSubmit={handleCreateSquad}
          isLoading={createSquad.isPending}
        />
      )}
    </MainLayout>
  );
}
