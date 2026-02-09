import MainLayout from '@/layouts/MainLayout';
import { ROLE_LABELS, UserRole } from '@/types/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Edit2, Trash2, MoreHorizontal, UserPlus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import CreateUserModal from '@/components/admin/CreateUserModal';
import EditUserModal from '@/components/admin/EditUserModal';
import { toast } from 'sonner';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, DbUser } from '@/hooks/useUsers';

export default function UsersPage() {
  const { user: currentUser, isAdminUser, isCEO, canManageUsersFlag, userGroupId, userSquadId } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DbUser | null>(null);

  const { data: users = [], isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // CEO, Gestor de Projetos e Sucesso do Cliente podem acessar esta página
  if (!canManageUsersFlag) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h2 className="font-display text-xl font-bold text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Filtrar usuários baseado na permissão do usuário logado
  // CEO vê todos, Gestor de Projetos e Sucesso do Cliente veem apenas seu grupo + áreas independentes
  const visibleUsers = isCEO 
    ? users 
    : users.filter(u => 
        u.group_id === userGroupId || // Mesmo grupo
        u.category_id !== null // Áreas independentes (não pertencem a grupos)
      );

  const filteredUsers = visibleUsers.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ROLE_LABELS[user.role].toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.group_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.squad_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateUser = async (newUser: { 
    name: string; 
    email: string; 
    role: UserRole; 
    group_id?: string;
    squad_id?: string;
    category_id?: string;
    is_coringa?: boolean;
  }, password: string) => {
    try {
      await createUser.mutateAsync({
        email: newUser.email,
        password,
        name: newUser.name,
        role: newUser.role,
        group_id: newUser.group_id,
        squad_id: newUser.squad_id,
        category_id: newUser.category_id,
        is_coringa: newUser.is_coringa,
      });
      
      setIsCreateModalOpen(false);
      toast.success('Usuário criado com sucesso!', {
        description: `${newUser.name} foi adicionado como ${ROLE_LABELS[newUser.role]}`,
      });
    } catch (err) {
      toast.error('Erro ao criar usuário', {
        description: err instanceof Error ? err.message : 'Tente novamente',
      });
    }
  };

  const handleEditUser = async (userId: string, updates: Partial<{ 
    name: string; 
    email: string; 
    role: UserRole; 
    group_id: string | null;
    squad_id: string | null;
    category_id: string | null;
    is_coringa: boolean;
  }>, newPassword?: string) => {
    try {
      await updateUser.mutateAsync({
        userId,
        ...updates,
        password: newPassword,
      });
      
      setEditingUser(null);
      toast.success('Usuário atualizado!', {
        description: 'As alterações foram salvas com sucesso.',
      });
    } catch (err) {
      toast.error('Erro ao atualizar usuário', {
        description: err instanceof Error ? err.message : 'Tente novamente',
      });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      await deleteUser.mutateAsync(userId);
      toast.success('Usuário removido', {
        description: `${userName} foi removido do sistema.`,
      });
    } catch (err) {
      toast.error('Erro ao remover usuário', {
        description: err instanceof Error ? err.message : 'Tente novamente',
      });
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

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h2 className="font-display text-xl font-bold text-danger">Erro ao carregar usuários</h2>
            <p className="text-muted-foreground mt-2">{error.message}</p>
          </div>
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
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
              Gestão de Usuários
            </h1>
            <p className="text-muted-foreground mt-1">
              {visibleUsers.length} usuários {!isCEO && '(do seu grupo)'}
            </p>
          </div>
          
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            disabled={createUser.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-primary text-primary-foreground font-display font-semibold uppercase text-sm
                     hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {createUser.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <UserPlus size={18} />
            )}
            Novo Usuário
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou cargo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-apple pl-11 w-full"
          />
        </div>

        {/* Users Table */}
        <div className="card-apple overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Usuário
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Cargo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Grupo / Squad
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    E-mail
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      {searchQuery ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr 
                      key={user.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              user.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex px-3 py-1 rounded-full text-xs font-medium",
                          user.role === 'ceo' ? "bg-primary/20 text-primary-foreground" :
                          user.role === 'gestor_projetos' ? "bg-info/10 text-info" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {ROLE_LABELS[user.role]}
                        </span>
                        {user.is_coringa && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning">
                            Coringa
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.group_name ? (
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">{user.group_name}</p>
                            {user.squad_name ? (
                              <p className="text-xs text-muted-foreground">{user.squad_name}</p>
                            ) : user.is_coringa ? (
                              <p className="text-xs text-warning">Coringa (múltiplos squads)</p>
                            ) : null}
                          </div>
                        ) : user.category_name ? (
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">{user.category_name}</p>
                            <p className="text-xs text-muted-foreground">Área Independente</p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground font-mono">{user.email}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem 
                              onClick={() => setEditingUser(user)}
                              className="cursor-pointer"
                            >
                              <Edit2 size={14} className="mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {user.role !== 'ceo' && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteUser(user.user_id, user.name)}
                                className="cursor-pointer text-danger focus:text-danger"
                                disabled={deleteUser.isPending}
                              >
                                <Trash2 size={14} className="mr-2" />
                                Remover
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Card */}
        <div className="card-apple p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Nota:</strong> O CEO pode criar, editar e remover usuários. 
            As senhas são gerenciadas de forma segura pelo sistema.
            O cargo de CEO não pode ser removido ou alterado.
          </p>
        </div>
      </div>

      {/* Create Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateUser}
        isLoading={createUser.isPending}
      />

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          isOpen={!!editingUser}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={handleEditUser}
          isLoading={updateUser.isPending}
        />
      )}
    </MainLayout>
  );
}
