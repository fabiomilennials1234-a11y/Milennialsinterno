import { useState, useEffect, useMemo } from 'react';
import { UserRole, ROLE_LABELS } from '@/types/auth';
import { X, Loader2, Users, AlertCircle, Info, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIndependentCategories } from '@/hooks/useOrganization';
import { useGroupsWithOccupancy } from '@/hooks/useGroupManagement';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (user: { 
    name: string; 
    email: string; 
    role: UserRole; 
    group_id?: string;
    squad_id?: string;
    category_id?: string;
    is_coringa?: boolean;
    additional_pages?: string[];
  }, password: string) => void;
  isLoading?: boolean;
}

// Cargos que pertencem a Grupos e Squads (operacionais)
const GROUP_SQUAD_ROLES: UserRole[] = [
  'gestor_ads',
  'sucesso_cliente',
  'design',
  'editor_video',
  'devs',
];

// Cargos Coringas (pertencem ao grupo, mas atuam em múltiplos squads)
const CORINGA_ROLES: UserRole[] = [
  'gestor_projetos',
  'gestor_crm',
  'consultor_comercial',
];

// Cargos Independentes (não pertencem a grupos/squads)
const INDEPENDENT_ROLES: UserRole[] = [
  'rh',
  'financeiro',
  'produtora',
  'atrizes_gravacao',
];

// Todos os cargos disponíveis (exceto CEO)
const AVAILABLE_ROLES: UserRole[] = [
  ...CORINGA_ROLES,
  ...GROUP_SQUAD_ROLES,
  ...INDEPENDENT_ROLES,
];

// Páginas disponíveis no sistema
const ALL_PAGES = [
  { id: 'gestor-ads', label: 'Gestão de Tráfego PRO+', icon: '📊' },
  { id: 'sucesso-cliente', label: 'Sucesso do Cliente PRO+', icon: '🤝' },
  { id: 'consultor-comercial', label: 'Comercial PRO+', icon: '💼' },
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

// Páginas padrão por cargo
const DEFAULT_PAGES_BY_ROLE: Record<UserRole, string[]> = {
  ceo: ALL_PAGES.map(p => p.id),
  gestor_projetos: ALL_PAGES.map(p => p.id),
  gestor_ads: ['gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial'],
  sucesso_cliente: ['sucesso-cliente', 'gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial', 'rh', 'cliente-list', 'cadastro-clientes', 'upsells'],
  design: ['design'],
  editor_video: ['editor-video', 'atrizes-gravacao'],
  devs: ['devs', 'design'],
  atrizes_gravacao: ['atrizes-gravacao', 'editor-video'],
  produtora: ['produtora'],
  gestor_crm: ['gestor-crm'],
  consultor_comercial: ['consultor-comercial'],
  financeiro: ['financeiro', 'cliente-list', 'comissoes'],
  rh: ['rh'],
};

// Função para determinar o tipo de alocação baseado no cargo
function getRoleAssignmentType(role: UserRole): 'group' | 'independent' | null {
  if (GROUP_SQUAD_ROLES.includes(role) || CORINGA_ROLES.includes(role)) {
    return 'group';
  }
  if (INDEPENDENT_ROLES.includes(role)) {
    return 'independent';
  }
  return null;
}

// Função para verificar se o cargo é coringa
function isCoringaRole(role: UserRole): boolean {
  return CORINGA_ROLES.includes(role);
}

// Labels para tipos de cargo
const ROLE_TYPE_LABELS: Record<string, string> = {
  coringa: 'Cargos Coringas (Grupo)',
  group_squad: 'Cargos Operacionais (Grupo + Squad)',
  independent: 'Cargos Independentes',
};

export default function CreateUserModal({ isOpen, onClose, onSubmit, isLoading }: CreateUserModalProps) {
  const { data: groups = [] } = useGroupsWithOccupancy();
  const { data: categories = [] } = useIndependentCategories();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as UserRole | '',
    group_id: '',
    squad_id: '',
    category_id: '',
  });
  const [additionalPages, setAdditionalPages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-determinar tipo de alocação e coringa baseado no cargo
  const assignmentType = formData.role ? getRoleAssignmentType(formData.role as UserRole) : null;
  const isCoringa = formData.role ? isCoringaRole(formData.role as UserRole) : false;
  const selectedGroup = groups.find(g => g.id === formData.group_id);

  // Páginas padrão do cargo selecionado
  const defaultPages = useMemo(() => {
    if (!formData.role) return [];
    return DEFAULT_PAGES_BY_ROLE[formData.role as UserRole] || [];
  }, [formData.role]);

  // Páginas disponíveis para adicionar (que não são padrão)
  const availableAdditionalPages = useMemo(() => {
    return ALL_PAGES.filter(p => !defaultPages.includes(p.id));
  }, [defaultPages]);

  // Limpar campos quando mudar o cargo
  useEffect(() => {
    if (formData.role) {
      const newAssignmentType = getRoleAssignmentType(formData.role as UserRole);
      if (newAssignmentType === 'independent') {
        setFormData(prev => ({
          ...prev,
          group_id: '',
          squad_id: '',
        }));
      } else if (newAssignmentType === 'group') {
        setFormData(prev => ({
          ...prev,
          category_id: '',
        }));
        // Se for coringa, limpar squad
        if (isCoringaRole(formData.role as UserRole)) {
          setFormData(prev => ({
            ...prev,
            squad_id: '',
          }));
        }
      }
      // Limpar páginas adicionais ao mudar o cargo
      setAdditionalPages([]);
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
    
    if (!formData.password.trim()) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }
    
    if (!formData.role) {
      newErrors.role = 'Cargo é obrigatório';
    }
    
    // Validação baseada no tipo de cargo
    if (assignmentType === 'group') {
      if (!formData.group_id) {
        newErrors.group_id = 'Grupo é obrigatório para este cargo';
      }
      
      // Cargos não-coringa precisam de squad
      if (!isCoringa && !formData.squad_id) {
        newErrors.squad_id = 'Squad é obrigatório para este cargo';
      }
      
      // Check if role has available slots in the selected group
      if (formData.group_id && formData.role) {
        const group = groups.find(g => g.id === formData.group_id);
        if (group) {
          const roleOccupancy = group.roleOccupancy.find(o => o.role === formData.role);
          if (roleOccupancy && roleOccupancy.current >= roleOccupancy.max) {
            newErrors.role = `Não há vagas para ${ROLE_LABELS[formData.role as UserRole]} neste grupo`;
          }
        }
      }
    }
    
    if (assignmentType === 'independent' && !formData.category_id) {
      newErrors.category_id = 'Área é obrigatória para este cargo';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    onSubmit({
      name: formData.name,
      email: formData.email,
      role: formData.role as UserRole,
      group_id: assignmentType === 'group' ? formData.group_id : undefined,
      squad_id: assignmentType === 'group' && !isCoringa ? formData.squad_id : undefined,
      category_id: assignmentType === 'independent' ? formData.category_id : undefined,
      is_coringa: isCoringa,
      additional_pages: additionalPages.length > 0 ? additionalPages : undefined,
    }, formData.password);
  };

  const handleClose = () => {
    if (isLoading) return;
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '',
      group_id: '',
      squad_id: '',
      category_id: '',
    });
    setAdditionalPages([]);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

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
            Novo Usuário
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
          {/* Nome */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Nome Completo <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Digite o nome completo"
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
              E-mail <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@millennialsb2b.com"
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
              Senha <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              disabled={isLoading}
              className={cn(
                "input-apple font-mono",
                errors.password && "border-danger focus:ring-danger/30"
              )}
            />
            {errors.password && (
              <p className="text-xs text-danger">{errors.password}</p>
            )}
          </div>

          {/* Cargo */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Cargo <span className="text-danger">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
              disabled={isLoading}
              className={cn(
                "input-apple",
                errors.role && "border-danger focus:ring-danger/30",
                !formData.role && "text-muted-foreground"
              )}
            >
              <option value="">Selecione um cargo</option>
              <optgroup label={ROLE_TYPE_LABELS.coringa}>
                {CORINGA_ROLES.map(role => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </optgroup>
              <optgroup label={ROLE_TYPE_LABELS.group_squad}>
                {GROUP_SQUAD_ROLES.map(role => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </optgroup>
              <optgroup label={ROLE_TYPE_LABELS.independent}>
                {INDEPENDENT_ROLES.map(role => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </optgroup>
            </select>
            {errors.role && (
              <p className="text-xs text-danger">{errors.role}</p>
            )}
          </div>

          {/* Indicador de Tipo de Alocação */}
          {formData.role && (
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-xl border",
              assignmentType === 'group' && isCoringa 
                ? "bg-warning/10 border-warning/30" 
                : assignmentType === 'group'
                ? "bg-primary/10 border-primary/30"
                : "bg-muted/50 border-border"
            )}>
              <Info size={16} className={cn(
                "mt-0.5 flex-shrink-0",
                assignmentType === 'group' && isCoringa 
                  ? "text-warning" 
                  : assignmentType === 'group'
                  ? "text-primary"
                  : "text-muted-foreground"
              )} />
              <div className="text-sm">
                {assignmentType === 'group' && isCoringa && (
                  <>
                    <span className="font-semibold text-warning">Cargo Coringa</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Este cargo pertence a um Grupo, mas atua em múltiplos Squads.
                    </p>
                  </>
                )}
                {assignmentType === 'group' && !isCoringa && (
                  <>
                    <span className="font-semibold text-primary">Cargo Operacional</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Este cargo pertence a um Grupo e Squad específico.
                    </p>
                  </>
                )}
                {assignmentType === 'independent' && (
                  <>
                    <span className="font-semibold text-foreground">Cargo Independente</span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Este cargo não pertence a Grupos ou Squads.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Campos para Cargos de Grupo (Coringas e Operacionais) */}
          {assignmentType === 'group' && (
            <>
              {/* Grupo */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Grupo <span className="text-danger">*</span>
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
                    errors.group_id && "border-danger focus:ring-danger/30",
                    !formData.group_id && "text-muted-foreground"
                  )}
                >
                  <option value="">Selecione um grupo</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.totalMembers}/{group.totalCapacity})
                    </option>
                  ))}
                </select>
                {errors.group_id && (
                  <p className="text-xs text-danger">{errors.group_id}</p>
                )}
              </div>

              {/* Role Occupancy Display */}
              {selectedGroup && selectedGroup.roleOccupancy.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                    <Users size={14} />
                    Vagas por Cargo
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                    {selectedGroup.roleOccupancy.map(occupancy => {
                      const isFull = occupancy.current >= occupancy.max;
                      const isSelected = formData.role === occupancy.role;
                      return (
                        <div 
                          key={occupancy.role}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors",
                            isSelected && "ring-1 ring-primary bg-primary/5",
                            isFull ? "bg-danger/10 text-danger" : "bg-background"
                          )}
                        >
                          <span className={cn(
                            "font-medium truncate",
                            isFull && "text-danger"
                          )}>
                            {occupancy.label}
                          </span>
                          <span className={cn(
                            "font-mono font-semibold ml-2",
                            isFull ? "text-danger" : "text-foreground"
                          )}>
                            {occupancy.current}/{occupancy.max}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {formData.role && selectedGroup.roleOccupancy.find(o => o.role === formData.role && o.current >= o.max) && (
                    <p className="text-xs text-danger flex items-center gap-1">
                      <AlertCircle size={12} />
                      Não há vagas disponíveis para este cargo neste grupo
                    </p>
                  )}
                </div>
              )}

              {/* Squad - apenas para cargos não-coringa */}
              {!isCoringa && formData.group_id && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Squad <span className="text-danger">*</span>
                  </label>
                  <select
                    value={formData.squad_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, squad_id: e.target.value }))}
                    disabled={isLoading || !selectedGroup?.squads?.length}
                    className={cn(
                      "input-apple",
                      errors.squad_id && "border-danger focus:ring-danger/30",
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
                  {errors.squad_id && (
                    <p className="text-xs text-danger">{errors.squad_id}</p>
                  )}
                  {selectedGroup && !selectedGroup.squads?.length && (
                    <p className="text-xs text-muted-foreground">Nenhum squad disponível neste grupo</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Campos para Cargos Independentes */}
          {assignmentType === 'independent' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Área Independente <span className="text-danger">*</span>
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                disabled={isLoading}
                className={cn(
                  "input-apple",
                  errors.category_id && "border-danger focus:ring-danger/30",
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
              {errors.category_id && (
                <p className="text-xs text-danger">{errors.category_id}</p>
              )}
            </div>
          )}

          {/* Páginas de Acesso */}
          {formData.role && (
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
              Criar Usuário
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
