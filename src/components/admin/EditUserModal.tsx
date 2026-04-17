import { useState, useEffect, useMemo } from 'react';
import { UserRole, ROLE_LABELS } from '@/types/auth';
import { X, Loader2, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DbUser } from '@/hooks/useUsers';
import { useOrganizationGroups, useIndependentCategories } from '@/hooks/useOrganization';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditUserModalProps {
  isOpen: boolean;
  user: DbUser | null;
  onClose: () => void;
  onSubmit: (userId: string, updates: Partial<{
    name: string;
    email: string;
    role: UserRole;
    group_id: string | null;
    squad_id: string | null;
    category_id: string | null;
    is_coringa: boolean;
    additional_pages: string[];
    can_access_mtech: boolean;
  }>, newPassword?: string) => void;
  isLoading?: boolean;
}

const AVAILABLE_ROLES: UserRole[] = [
  'gestor_projetos',
  'gestor_ads',
  'outbound',
  'sucesso_cliente',
  'design',
  'editor_video',
  'devs',
  'atrizes_gravacao',
  'produtora',
  'gestor_crm',
  'consultor_comercial',
  'consultor_mktplace',
  'financeiro',
  'rh',
];

// Páginas disponíveis no sistema (mesma lista do CreateUserModal)
const ALL_PAGES = [
  { id: 'gestor-ads', label: 'Gestão de Tráfego PRO+', icon: '📊' },
  { id: 'sucesso-cliente', label: 'Sucesso do Cliente PRO+', icon: '🤝' },
  { id: 'consultor-comercial', label: 'Treinador Comercial PRO+', icon: '💼' },
  { id: 'financeiro', label: 'Financeiro PRO+', icon: '💰' },
  { id: 'gestor-projetos', label: 'Gestão de Projetos PRO+', icon: '📋' },
  { id: 'gestor-crm', label: 'CRM PRO+', icon: '📇' },
  { id: 'design', label: 'Design PRO+', icon: '🎨' },
  { id: 'editor-video', label: 'Editor de Vídeo PRO+', icon: '🎬' },
  { id: 'devs', label: 'Desenvolvedor PRO+', icon: '💻' },
  { id: 'atrizes-gravacao', label: 'Gravação PRO+', icon: '🎭' },
  { id: 'rh', label: 'RH PRO+', icon: '👥' },
  { id: 'produtora', label: 'Produtora', icon: '🎥' },
  { id: 'cliente-list', label: 'Lista de Clientes', icon: '📝' },
  { id: 'cadastro-clientes', label: 'Cadastro de Clientes', icon: '➕' },
  { id: 'upsells', label: 'UP Sells', icon: '📈' },
  { id: 'comissoes', label: 'Comissões', icon: '💵' },
];

// Páginas padrão por cargo (mesma lista do CreateUserModal)
const DEFAULT_PAGES_BY_ROLE: Record<UserRole, string[]> = {
  ceo: ALL_PAGES.map(p => p.id),
  cto: ALL_PAGES.map(p => p.id),
  gestor_projetos: ALL_PAGES.map(p => p.id),
  gestor_ads: ['gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial'],
  outbound: ['gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial'],
  sucesso_cliente: ['sucesso-cliente', 'gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial', 'rh', 'cliente-list', 'cadastro-clientes', 'upsells'],
  design: ['design'],
  editor_video: ['editor-video', 'atrizes-gravacao'],
  devs: ['devs', 'design'],
  atrizes_gravacao: ['atrizes-gravacao', 'editor-video'],
  produtora: ['produtora'],
  gestor_crm: ['gestor-crm'],
  consultor_comercial: ['consultor-comercial'],
  consultor_mktplace: ['consultor-comercial'],
  financeiro: ['financeiro', 'cliente-list', 'comissoes'],
  rh: ['rh'],
};

export default function EditUserModal({ isOpen, user, onClose, onSubmit, isLoading }: EditUserModalProps) {
  const { data: groups = [] } = useOrganizationGroups();
  const { data: categories = [] } = useIndependentCategories();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as UserRole,
    assignmentType: '' as 'group' | 'category' | '',
    group_id: '',
    squad_id: '',
    category_id: '',
    is_coringa: false,
    can_access_mtech: false,
  });
  const [additionalPages, setAdditionalPages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      // Determine assignment type based on user data
      let assignmentType: 'group' | 'category' | '' = '';
      if (user.group_id || user.squad_id) {
        assignmentType = 'group';
      } else if (user.category_id) {
        assignmentType = 'category';
      }

      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        assignmentType,
        group_id: user.group_id || '',
        squad_id: user.squad_id || '',
        category_id: user.category_id || '',
        is_coringa: user.is_coringa || false,
        can_access_mtech: user.can_access_mtech === true,
      });
      setAdditionalPages(user.additional_pages || []);
    }
  }, [user]);

  // Páginas padrão do cargo selecionado
  const defaultPages = useMemo(() => {
    if (!formData.role) return [];
    return DEFAULT_PAGES_BY_ROLE[formData.role] || [];
  }, [formData.role]);

  // Páginas disponíveis para adicionar (que não são padrão)
  const availableAdditionalPages = useMemo(() => {
    return ALL_PAGES.filter(p => !defaultPages.includes(p.id));
  }, [defaultPages]);

  // Quando mudar o cargo, filtrar páginas adicionais que agora são padrão
  useEffect(() => {
    if (formData.role) {
      const newDefaults = DEFAULT_PAGES_BY_ROLE[formData.role] || [];
      setAdditionalPages(prev => prev.filter(p => !newDefaults.includes(p)));
    }
  }, [formData.role]);

  const toggleAdditionalPage = (pageId: string) => {
    setAdditionalPages(prev =>
      prev.includes(pageId)
        ? prev.filter(p => p !== pageId)
        : [...prev, pageId]
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const selectedGroup = groups.find(g => g.id === formData.group_id);

  const mtechByRole = formData.role === 'ceo' || formData.role === 'cto' || formData.role === 'devs';
  const effectiveMtechAccess = mtechByRole || formData.can_access_mtech;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user) return;

    const updates: Partial<{
      name: string;
      email: string;
      role: UserRole;
      group_id: string | null;
      squad_id: string | null;
      category_id: string | null;
      is_coringa: boolean;
      additional_pages: string[];
      can_access_mtech: boolean;
    }> = {
      name: formData.name,
      email: formData.email,
      additional_pages: additionalPages,
      can_access_mtech: effectiveMtechAccess,
    };

    // Só inclui role se não for CEO
    if (user.role !== 'ceo') {
      updates.role = formData.role;
    }

    // Handle group/squad/category assignment
    if (formData.assignmentType === 'group') {
      updates.group_id = formData.group_id || null;
      updates.squad_id = formData.is_coringa ? null : (formData.squad_id || null);
      updates.category_id = null;
      updates.is_coringa = formData.is_coringa;
    } else if (formData.assignmentType === 'category') {
      updates.group_id = null;
      updates.squad_id = null;
      updates.category_id = formData.category_id || null;
      updates.is_coringa = false;
    } else {
      updates.group_id = null;
      updates.squad_id = null;
      updates.category_id = null;
      updates.is_coringa = false;
    }

    const newPassword = formData.password.trim() || undefined;

    onSubmit(user.user_id, updates, newPassword);
  };

  const handleClose = () => {
    if (isLoading) return;
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '' as UserRole,
      assignmentType: '',
      group_id: '',
      squad_id: '',
      category_id: '',
      is_coringa: false,
      can_access_mtech: false,
    });
    setAdditionalPages([]);
    setErrors({});
    onClose();
  };

  if (!isOpen || !user) return null;

  const isCEO = user.role === 'ceo' || user.role === 'cto';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
            Editar Usuário
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Avatar Preview */}
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-display font-bold text-2xl">
              {user.avatar ? (
                <img src={user.avatar} alt={formData.name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                formData.name.charAt(0) || user.name.charAt(0)
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">{formData.name || user.name}</p>
              <p className="text-sm text-muted-foreground">{ROLE_LABELS[formData.role || user.role]}</p>
            </div>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Nome Completo
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isLoading}
              className={cn(
                "input-apple",
                errors.name && "border-danger focus:ring-danger/30"
              )}
            />
            {errors.name && (
              <p className="text-xs text-danger">{errors.name}</p>
            )}
          </div>

          {/* E-mail */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              E-mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={isLoading}
              className={cn(
                "input-apple",
                errors.email && "border-danger focus:ring-danger/30"
              )}
            />
            {errors.email && (
              <p className="text-xs text-danger">{errors.email}</p>
            )}
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Nova Senha (opcional)
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Deixe em branco para manter a atual"
              disabled={isLoading}
              className={cn(
                "input-apple font-mono",
                errors.password && "border-danger focus:ring-danger/30"
              )}
            />
            {errors.password && (
              <p className="text-xs text-danger">{errors.password}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Preencha apenas se desejar alterar a senha
            </p>
          </div>

          {/* Cargo */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Cargo
            </label>
            {isCEO ? (
              <div className="input-apple bg-muted/50 text-muted-foreground cursor-not-allowed">
                CEO (não pode ser alterado)
              </div>
            ) : (
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                disabled={isLoading}
                className="input-apple"
              >
                {AVAILABLE_ROLES.map(role => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tipo de Alocação - only show for non-CEO */}
          {!isCEO && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Tipo de Alocação
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      assignmentType: 'group',
                      category_id: '',
                    }))}
                    disabled={isLoading}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
                      formData.assignmentType === 'group'
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    Grupo/Squad
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      assignmentType: 'category',
                      group_id: '',
                      squad_id: '',
                      is_coringa: false,
                    }))}
                    disabled={isLoading}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border",
                      formData.assignmentType === 'category'
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    Área Independente
                  </button>
                </div>
              </div>

              {/* Campos condicionais para Grupo/Squad */}
              {formData.assignmentType === 'group' && (
                <>
                  {/* Grupo */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Grupo
                    </label>
                    <select
                      value={formData.group_id}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        group_id: e.target.value,
                        squad_id: '',
                      }))}
                      disabled={isLoading}
                      className={cn(
                        "input-apple",
                        !formData.group_id && "text-muted-foreground"
                      )}
                    >
                      <option value="">Selecione um grupo</option>
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Coringa Toggle */}
                  {formData.group_id && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                      <input
                        type="checkbox"
                        id="edit_is_coringa"
                        checked={formData.is_coringa}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          is_coringa: e.target.checked,
                          squad_id: e.target.checked ? '' : prev.squad_id,
                        }))}
                        disabled={isLoading}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label htmlFor="edit_is_coringa" className="text-sm text-foreground">
                        Este usuário é <span className="font-semibold">Coringa</span> (atua em todo o grupo)
                      </label>
                    </div>
                  )}

                  {/* Squad */}
                  {formData.group_id && !formData.is_coringa && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        Squad
                      </label>
                      <select
                        value={formData.squad_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, squad_id: e.target.value }))}
                        disabled={isLoading || !selectedGroup?.squads?.length}
                        className={cn(
                          "input-apple",
                          !formData.squad_id && "text-muted-foreground"
                        )}
                      >
                        <option value="">Selecione um squad</option>
                        {selectedGroup?.squads?.map(squad => (
                          <option key={squad.id} value={squad.id}>
                            {squad.name}
                          </option>
                        ))}
                      </select>
                      {selectedGroup && !selectedGroup.squads?.length && (
                        <p className="text-xs text-muted-foreground">Nenhum squad disponível neste grupo</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Campos condicionais para Área Independente */}
              {formData.assignmentType === 'category' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Área Independente
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                    disabled={isLoading}
                    className={cn(
                      "input-apple",
                      !formData.category_id && "text-muted-foreground"
                    )}
                  >
                    <option value="">Selecione uma área</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Páginas de Acesso */}
          {formData.role && !isCEO && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                <FileText size={14} />
                Páginas de Acesso
              </label>

              {/* Páginas Padrão */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Páginas padrão do cargo:</p>
                <div className="flex flex-wrap gap-1.5">
                  {defaultPages.length > 0 ? (
                    defaultPages.map(pageId => {
                      const page = ALL_PAGES.find(p => p.id === pageId);
                      if (!page) return null;
                      return (
                        <Badge
                          key={pageId}
                          variant="secondary"
                          className="text-xs py-1 px-2 bg-primary/10 text-primary border-primary/20"
                        >
                          <span className="mr-1">{page.icon}</span>
                          {page.label}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhuma página padrão</span>
                  )}
                </div>
              </div>

              {/* Páginas Adicionais */}
              {availableAdditionalPages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Páginas adicionais (opcional):</p>
                  <ScrollArea className="h-[120px] border rounded-xl p-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      {availableAdditionalPages.map(page => {
                        const isSelected = additionalPages.includes(page.id);
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => toggleAdditionalPage(page.id)}
                            disabled={isLoading}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg text-xs text-left transition-colors",
                              isSelected
                                ? "bg-primary/10 border border-primary/30 text-primary"
                                : "bg-muted/50 border border-transparent hover:bg-muted"
                            )}
                          >
                            {isSelected ? (
                              <Check size={12} className="text-primary flex-shrink-0" />
                            ) : (
                              <div className="w-3 h-3 rounded border border-muted-foreground/30 flex-shrink-0" />
                            )}
                            <span className="mr-1">{page.icon}</span>
                            <span className="truncate">{page.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {additionalPages.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {additionalPages.length} página(s) adicional(is) selecionada(s)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 pt-4 border-t border-border">
            <label className="block text-sm font-medium text-foreground">Acesso a módulos</label>
            <label
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                effectiveMtechAccess ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border hover:bg-muted/50",
                mtechByRole && "cursor-not-allowed opacity-90"
              )}
              title={mtechByRole ? 'Acesso garantido pelo cargo' : undefined}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                checked={effectiveMtechAccess}
                disabled={mtechByRole || isLoading}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, can_access_mtech: e.target.checked }))
                }
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">Milennials Tech</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mtechByRole
                    ? 'Acesso garantido pelo cargo.'
                    : 'Permite ver o kanban e backlog técnico independente do cargo.'}
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-semibold uppercase text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
