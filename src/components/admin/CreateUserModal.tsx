import { useState, useEffect, useMemo } from 'react';
import { UserRole, ROLE_LABELS } from '@/types/auth';
import { X, Loader2, Users, AlertCircle, Info, FileText, Check, Plus, ChevronLeft, Trash2, Shield, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIndependentCategories, useOrganizationGroups } from '@/hooks/useOrganization';
import { useGroupsWithOccupancy } from '@/hooks/useGroupManagement';
import { useCustomRoles, useCreateCustomRole, useDeleteCustomRole } from '@/hooks/useCustomRoles';
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
    can_access_mtech?: boolean;
  }, password: string) => void;
  isLoading?: boolean;
}

// Cargos que pertencem a Grupos e Squads (operacionais)
const GROUP_SQUAD_ROLES: UserRole[] = [
  'gestor_ads', 'sucesso_cliente', 'design', 'editor_video', 'devs',
];

// Cargos Coringas (pertencem ao grupo, mas atuam em múltiplos squads)
const CORINGA_ROLES: UserRole[] = ['gestor_projetos'];

// Cargos Independentes
const INDEPENDENT_ROLES: UserRole[] = ['rh', 'financeiro', 'produtora', 'atrizes_gravacao'];

// Cargos com destino fixo (não pedem grupo, squad nem área)
const FIXED_PADDOCK_ROLES: UserRole[] = ['consultor_comercial', 'consultor_mktplace'];
const FIXED_TORQUE_ROLES: UserRole[] = ['gestor_crm'];
const FIXED_OUTBOUND_ROLES: UserRole[] = ['outbound'];
const ALL_FIXED_ROLES: UserRole[] = [...FIXED_PADDOCK_ROLES, ...FIXED_TORQUE_ROLES, ...FIXED_OUTBOUND_ROLES];

// Páginas disponíveis no sistema
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

// Páginas padrão por cargo
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

function getRoleAssignmentType(role: UserRole): 'group' | 'independent' | 'fixed' | null {
  if (GROUP_SQUAD_ROLES.includes(role) || CORINGA_ROLES.includes(role)) return 'group';
  if (INDEPENDENT_ROLES.includes(role)) return 'independent';
  if (ALL_FIXED_ROLES.includes(role)) return 'fixed';
  return null;
}

function getFixedDestinationLabel(role: UserRole): { title: string; description: string } | null {
  if (role === 'consultor_mktplace') return { title: 'Educacional → Consultoria de MKT Place', description: 'Este cargo é vinculado automaticamente à Consultoria de MKT Place. Nenhuma configuração adicional necessária.' };
  if (FIXED_PADDOCK_ROLES.includes(role)) return { title: 'Educacional → Millennials Paddock', description: 'Este cargo é vinculado automaticamente ao Paddock. Nenhuma configuração adicional necessária.' };
  if (FIXED_TORQUE_ROLES.includes(role)) return { title: 'SaaS → Torque', description: 'Este cargo é vinculado automaticamente ao Torque. Nenhuma configuração adicional necessária.' };
  if (FIXED_OUTBOUND_ROLES.includes(role)) return { title: 'Outbound', description: 'Este cargo é vinculado automaticamente ao Outbound. Nenhuma configuração adicional necessária.' };
  return null;
}

function isCoringaRole(role: UserRole): boolean {
  return CORINGA_ROLES.includes(role);
}

const ROLE_TYPE_LABELS: Record<string, string> = {
  coringa: 'Cargos Coringas (Grupo)',
  group_squad: 'Cargos Operacionais (Grupo + Squad)',
  independent: 'Cargos Independentes',
};

// ─── Tela de criação de perfil customizado ───
function CreateCustomRoleView({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (roleId: string) => void;
}) {
  const createCustomRole = useCreateCustomRole();
  const { data: orgGroups = [] } = useOrganizationGroups();
  const [profileName, setProfileName] = useState('');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [isViewer, setIsViewer] = useState(false);
  const [associateSquad, setAssociateSquad] = useState(false);
  const [selectedSquadId, setSelectedSquadId] = useState('');
  const [error, setError] = useState('');

  const allSquads = useMemo(() => {
    return orgGroups.flatMap(g => (g.squads || []).map((s: any) => ({ ...s, groupName: g.name })));
  }, [orgGroups]);

  const togglePage = (pageId: string) => {
    setSelectedPages(prev => prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]);
  };
  const selectAll = () => setSelectedPages(ALL_PAGES.map(p => p.id));
  const clearAll = () => setSelectedPages([]);

  const handleCreate = async () => {
    if (!profileName.trim()) { setError('Nome do perfil é obrigatório'); return; }
    if (selectedPages.length === 0) { setError('Selecione pelo menos uma página de acesso'); return; }
    if (associateSquad && !selectedSquadId) { setError('Selecione o Squad'); return; }
    setError('');

    try {
      const slug = profileName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const result = await createCustomRole.mutateAsync({
        name: slug,
        display_name: profileName.trim(),
        allowed_pages: selectedPages,
        is_viewer: isViewer,
        squad_id: associateSquad && selectedSquadId ? selectedSquadId : null,
      });
      onCreated(result.id);
    } catch (err: any) {
      const msg = err.message || 'Erro ao criar perfil';
      if (msg.includes('schema cache') || msg.includes('custom_roles')) {
        setError('A tabela de perfis customizados ainda não foi criada no banco. Execute a migration 20260319100000_create_custom_roles.sql no Supabase.');
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft size={16} /> Voltar
      </button>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">Novo Perfil de Acesso</h3>
        </div>

        <div className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Nome do Perfil <span className="text-danger">*</span></label>
            <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Ex: Assistente Financeiro, Coordenador..." className="input-apple" />
          </div>

          {/* Tipo: Normal ou Visualizador */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Tipo de Acesso</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsViewer(false)} className={cn(
                "p-3 rounded-xl border text-sm text-left transition-colors",
                !isViewer ? "bg-primary/10 border-primary/30 text-foreground" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {!isViewer ? <Check size={14} className="text-primary" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />}
                  <span className="font-semibold">Normal</span>
                </div>
                <p className="text-xs text-muted-foreground">Pode visualizar e editar</p>
              </button>
              <button type="button" onClick={() => setIsViewer(true)} className={cn(
                "p-3 rounded-xl border text-sm text-left transition-colors",
                isViewer ? "bg-primary/10 border-primary/30 text-foreground" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {isViewer ? <Check size={14} className="text-primary" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />}
                  <Eye size={14} className={isViewer ? "text-primary" : "text-muted-foreground"} />
                  <span className="font-semibold">Visualizador</span>
                </div>
                <p className="text-xs text-muted-foreground">Apenas visualizar, sem editar</p>
              </button>
            </div>
          </div>

          {/* Associar a Squad? */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Associar a um Squad?</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setAssociateSquad(false); setSelectedSquadId(''); }} className={cn(
                "p-2.5 rounded-xl border text-sm text-center transition-colors",
                !associateSquad ? "bg-primary/10 border-primary/30 font-semibold" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
              )}>
                Não
              </button>
              <button type="button" onClick={() => setAssociateSquad(true)} className={cn(
                "p-2.5 rounded-xl border text-sm text-center transition-colors",
                associateSquad ? "bg-primary/10 border-primary/30 font-semibold" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
              )}>
                Sim
              </button>
            </div>
            {associateSquad && (
              <select value={selectedSquadId} onChange={(e) => setSelectedSquadId(e.target.value)} className="input-apple mt-2">
                <option value="">Selecione o Squad</option>
                {allSquads.map((squad: any) => (
                  <option key={squad.id} value={squad.id}>{squad.groupName} → {squad.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Páginas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">Páginas de Acesso <span className="text-danger">*</span></label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-[10px] text-primary hover:underline">Selecionar Tudo</button>
                <button type="button" onClick={clearAll} className="text-[10px] text-muted-foreground hover:underline">Limpar</button>
              </div>
            </div>
            <ScrollArea className="h-[180px] border rounded-xl p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_PAGES.map(page => {
                  const isSelected = selectedPages.includes(page.id);
                  return (
                    <button key={page.id} type="button" onClick={() => togglePage(page.id)} className={cn(
                      "flex items-center gap-2 p-2 rounded-lg text-xs text-left transition-colors",
                      isSelected ? "bg-primary/10 border border-primary/30 text-primary" : "bg-muted/50 border border-transparent hover:bg-muted"
                    )}>
                      {isSelected ? <Check size={12} className="text-primary flex-shrink-0" /> : <div className="w-3 h-3 rounded border border-muted-foreground/30 flex-shrink-0" />}
                      <span className="mr-1">{page.icon}</span>
                      <span className="truncate">{page.label}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            {selectedPages.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedPages.length} de {ALL_PAGES.length} páginas selecionadas</p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20">
              <p className="text-xs text-danger flex items-start gap-1.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </p>
            </div>
          )}

          <button type="button" onClick={handleCreate} disabled={createCustomRole.isPending} className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {createCustomRole.isPending && <Loader2 size={14} className="animate-spin" />}
            Criar Perfil de Acesso
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal principal ───
export default function CreateUserModal({ isOpen, onClose, onSubmit, isLoading }: CreateUserModalProps) {
  const { data: groups = [] } = useGroupsWithOccupancy();
  const { data: categories = [] } = useIndependentCategories();
  const { data: customRoles = [] } = useCustomRoles();
  const deleteCustomRole = useDeleteCustomRole();

  const [formData, setFormData] = useState({
    name: '', email: '', password: '',
    role: '' as UserRole | '',
    group_id: '', squad_id: '', category_id: '',
    can_access_mtech: false,
  });
  const [additionalPages, setAdditionalPages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null>(null);
  // 'standard' = cargo padrão, 'custom' = perfil personalizado
  const [accessMode, setAccessMode] = useState<'standard' | 'custom' | null>(null);

  const assignmentType = formData.role ? getRoleAssignmentType(formData.role as UserRole) : null;
  const isCoringa = formData.role ? isCoringaRole(formData.role as UserRole) : false;
  const selectedGroup = groups.find(g => g.id === formData.group_id);
  const mtechByRole = formData.role === 'ceo' || formData.role === 'cto' || formData.role === 'devs';
  const effectiveMtechAccess = mtechByRole || formData.can_access_mtech;

  const selectedCustomRole = useMemo(() => {
    if (!selectedCustomRoleId) return null;
    return customRoles.find(r => r.id === selectedCustomRoleId) || null;
  }, [selectedCustomRoleId, customRoles]);

  const defaultPages = useMemo(() => {
    if (selectedCustomRole) return selectedCustomRole.allowed_pages;
    if (!formData.role) return [];
    return DEFAULT_PAGES_BY_ROLE[formData.role as UserRole] || [];
  }, [formData.role, selectedCustomRole]);

  const availableAdditionalPages = useMemo(() => {
    return ALL_PAGES.filter(p => !defaultPages.includes(p.id));
  }, [defaultPages]);

  useEffect(() => {
    if (formData.role) {
      const newAssignmentType = getRoleAssignmentType(formData.role as UserRole);
      if (newAssignmentType === 'independent') {
        setFormData(prev => ({ ...prev, group_id: '', squad_id: '' }));
      } else if (newAssignmentType === 'group') {
        setFormData(prev => ({ ...prev, category_id: '' }));
        if (isCoringaRole(formData.role as UserRole)) {
          setFormData(prev => ({ ...prev, squad_id: '' }));
        }
      }
      setAdditionalPages([]);
    }
  }, [formData.role]);

  const toggleAdditionalPage = (pageId: string) => {
    setAdditionalPages(prev => prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!formData.email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'E-mail inválido';
    if (!formData.password.trim()) newErrors.password = 'Senha é obrigatória';
    else if (formData.password.length < 6) newErrors.password = 'Senha deve ter pelo menos 6 caracteres';

    if (!accessMode) {
      newErrors.role = 'Selecione um perfil de acesso';
    } else {
      // Cargo é obrigatório em AMBOS os modos. O perfil customizado define apenas
      // páginas adicionais — nunca o papel (role) do usuário.
      if (!formData.role) newErrors.role = 'Cargo é obrigatório';

      if (accessMode === 'standard') {
        if (assignmentType === 'group') {
          if (!formData.group_id) newErrors.group_id = 'Grupo é obrigatório para este cargo';
          if (!isCoringa && !formData.squad_id) newErrors.squad_id = 'Squad é obrigatório para este cargo';
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
        if (assignmentType === 'independent' && !formData.category_id) newErrors.category_id = 'Área é obrigatória para este cargo';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (accessMode === 'custom' && selectedCustomRole) {
      // Perfil personalizado: o role vem do dropdown escolhido pelo admin (nunca hardcoded).
      // As páginas do perfil customizado entram como additional_pages, excluindo
      // as que já fazem parte das defaults do cargo para evitar redundância.
      const roleDefaults = DEFAULT_PAGES_BY_ROLE[formData.role as UserRole] || [];
      const extraPages = selectedCustomRole.allowed_pages.filter(p => !roleDefaults.includes(p));

      onSubmit({
        name: formData.name,
        email: formData.email,
        role: formData.role as UserRole,
        additional_pages: extraPages.length > 0 ? extraPages : undefined,
        can_access_mtech: effectiveMtechAccess,
      }, formData.password);
    } else {
      // Cargo padrão do sistema
      const finalAdditionalPages = [...additionalPages];

      onSubmit({
        name: formData.name,
        email: formData.email,
        role: formData.role as UserRole,
        group_id: assignmentType === 'group' ? formData.group_id : undefined,
        squad_id: assignmentType === 'group' && !isCoringa ? formData.squad_id : undefined,
        category_id: assignmentType === 'independent' ? formData.category_id : undefined,
        is_coringa: isCoringa,
        additional_pages: finalAdditionalPages.length > 0 ? finalAdditionalPages : undefined,
        can_access_mtech: effectiveMtechAccess,
      }, formData.password);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setFormData({ name: '', email: '', password: '', role: '', group_id: '', squad_id: '', category_id: '', can_access_mtech: false });
    setAdditionalPages([]);
    setErrors({});
    setShowCreateProfile(false);
    setSelectedCustomRoleId(null);
    setAccessMode(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in" onClick={handleClose} />

      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
            {showCreateProfile ? 'Novo Perfil de Acesso' : 'Novo Usuário'}
          </h2>
          <button onClick={handleClose} disabled={isLoading} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {showCreateProfile ? (
            <CreateCustomRoleView
              onBack={() => setShowCreateProfile(false)}
              onCreated={(roleId) => {
                setSelectedCustomRoleId(roleId);
                setAccessMode('custom');
                setShowCreateProfile(false);
              }}
            />
          ) : (
            <>
              {/* ═══ DADOS BÁSICOS ═══ */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Nome Completo <span className="text-danger">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Digite o nome completo" disabled={isLoading} className={cn("input-apple", errors.name && "border-danger focus:ring-danger/30")} />
                {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">E-mail <span className="text-danger">*</span></label>
                <input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="email@millennialsb2b.com" disabled={isLoading} className={cn("input-apple", errors.email && "border-danger focus:ring-danger/30")} />
                {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Senha <span className="text-danger">*</span></label>
                <input type="text" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} placeholder="Mínimo 6 caracteres" disabled={isLoading} className={cn("input-apple font-mono", errors.password && "border-danger focus:ring-danger/30")} />
                {errors.password && <p className="text-xs text-danger">{errors.password}</p>}
              </div>

              {/* ═══ PERFIL DE ACESSO (ANTES DO CARGO) ═══ */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield size={14} />
                  Perfil de Acesso
                </label>

                <div className="space-y-2">
                  {/* Opção: Cargo Padrão */}
                  <button type="button" onClick={() => { setAccessMode('standard'); setSelectedCustomRoleId(null); }}
                    className={cn("w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-colors",
                      accessMode === 'standard' ? "bg-primary/10 border-primary/30 text-foreground" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                    )}>
                    {accessMode === 'standard' ? <Check size={14} className="text-primary shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">Cargo Padrão do Sistema</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Selecionar um dos cargos existentes com permissões predefinidas</p>
                    </div>
                  </button>

                  {/* Perfis customizados salvos */}
                  {customRoles.map(customRole => (
                    <div key={customRole.id} className={cn("w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-colors",
                      selectedCustomRoleId === customRole.id ? "bg-primary/10 border-primary/30 text-foreground" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                    )}>
                      <button type="button" onClick={() => { setSelectedCustomRoleId(customRole.id); setAccessMode('custom'); }} className="flex items-center gap-3 flex-1 min-w-0">
                        {selectedCustomRoleId === customRole.id ? <Check size={14} className="text-primary shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{customRole.display_name}</span>
                            {customRole.is_viewer && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-info/30 text-info">
                                <Eye size={10} className="mr-0.5" /> Visualizador
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{customRole.allowed_pages.length} páginas de acesso</p>
                        </div>
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir perfil "${customRole.display_name}"?`)) { deleteCustomRole.mutate(customRole.id); if (selectedCustomRoleId === customRole.id) { setSelectedCustomRoleId(null); setAccessMode(null); } } }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors shrink-0" title="Excluir perfil">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {/* Botão criar novo */}
                  <button type="button" onClick={() => setShowCreateProfile(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/30 text-sm text-primary hover:bg-primary/5 transition-colors">
                    <Plus size={14} className="shrink-0" />
                    <span className="font-medium">Criar Novo Perfil de Acesso</span>
                  </button>
                </div>

                {/* Mostrar páginas do perfil customizado selecionado */}
                {selectedCustomRole && accessMode === 'custom' && (
                  <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">Páginas deste perfil:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCustomRole.allowed_pages.map(pageId => {
                        const page = ALL_PAGES.find(p => p.id === pageId);
                        if (!page) return null;
                        return (
                          <Badge key={pageId} variant="secondary" className="text-xs py-1 px-2 bg-primary/10 text-primary border-primary/20">
                            <span className="mr-1">{page.icon}</span>{page.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {errors.role && !accessMode && (
                  <p className="text-xs text-danger mt-1">{errors.role}</p>
                )}
              </div>

              {/* ═══ CARGO — obrigatório em AMBOS os modos (standard e custom) ═══ */}
              {accessMode && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Cargo <span className="text-danger">*</span>
                  </label>
                  <select value={formData.role} onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))} disabled={isLoading}
                    className={cn("input-apple", errors.role && "border-danger focus:ring-danger/30", !formData.role && "text-muted-foreground")}>
                    <option value="">Selecione um cargo</option>
                    <optgroup label={ROLE_TYPE_LABELS.coringa}>
                      {CORINGA_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </optgroup>
                    <optgroup label={ROLE_TYPE_LABELS.group_squad}>
                      {GROUP_SQUAD_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </optgroup>
                    <optgroup label={ROLE_TYPE_LABELS.independent}>
                      {INDEPENDENT_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </optgroup>
                    <optgroup label="Educacional (Paddock)">
                      {FIXED_PADDOCK_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </optgroup>
                    <optgroup label="SaaS (Torque)">
                      {FIXED_TORQUE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </optgroup>
                    <optgroup label="Outbound">
                      {FIXED_OUTBOUND_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </optgroup>
                  </select>
                  {errors.role && <p className="text-xs text-danger">{errors.role}</p>}
                  {accessMode === 'custom' && (
                    <p className="text-xs text-muted-foreground">
                      O cargo define o papel base do usuário. O perfil personalizado acima apenas concede páginas extras sobre esse cargo.
                    </p>
                  )}
                </div>
              )}

              {accessMode === 'standard' && (<>
              {/* Indicador de Tipo de Alocação */}
              {formData.role && (
                <div className={cn("flex items-start gap-3 p-3 rounded-xl border",
                  assignmentType === 'fixed' ? "bg-emerald-500/10 border-emerald-500/30" :
                  assignmentType === 'group' && isCoringa ? "bg-warning/10 border-warning/30" :
                  assignmentType === 'group' ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
                )}>
                  <Info size={16} className={cn("mt-0.5 flex-shrink-0",
                    assignmentType === 'fixed' ? "text-emerald-500" :
                    assignmentType === 'group' && isCoringa ? "text-warning" : assignmentType === 'group' ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="text-sm">
                    {assignmentType === 'fixed' && formData.role && (() => { const dest = getFixedDestinationLabel(formData.role as UserRole); return dest ? <><span className="font-semibold text-emerald-600">{dest.title}</span><p className="text-muted-foreground text-xs mt-0.5">{dest.description}</p></> : null; })()}
                    {assignmentType === 'group' && isCoringa && (<><span className="font-semibold text-warning">Cargo Coringa</span><p className="text-muted-foreground text-xs mt-0.5">Este cargo pertence a um Grupo, mas atua em múltiplos Squads.</p></>)}
                    {assignmentType === 'group' && !isCoringa && (<><span className="font-semibold text-primary">Cargo Operacional</span><p className="text-muted-foreground text-xs mt-0.5">Este cargo pertence a um Grupo e Squad específico.</p></>)}
                    {assignmentType === 'independent' && (<><span className="font-semibold text-foreground">Cargo Independente</span><p className="text-muted-foreground text-xs mt-0.5">Este cargo não pertence a Grupos ou Squads.</p></>)}
                  </div>
                </div>
              )}

              {/* Campos para Cargos de Grupo */}
              {assignmentType === 'group' && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">Grupo <span className="text-danger">*</span></label>
                    <select value={formData.group_id} onChange={(e) => setFormData(prev => ({ ...prev, group_id: e.target.value, squad_id: '' }))} disabled={isLoading}
                      className={cn("input-apple", errors.group_id && "border-danger focus:ring-danger/30", !formData.group_id && "text-muted-foreground")}>
                      <option value="">Selecione um grupo</option>
                      {groups.map(group => <option key={group.id} value={group.id}>{group.name} ({group.totalMembers}/{group.totalCapacity})</option>)}
                    </select>
                    {errors.group_id && <p className="text-xs text-danger">{errors.group_id}</p>}
                  </div>

                  {selectedGroup && selectedGroup.roleOccupancy.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground flex items-center gap-2"><Users size={14} />Vagas por Cargo</label>
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                        {selectedGroup.roleOccupancy.map(occupancy => {
                          const isFull = occupancy.current >= occupancy.max;
                          const isSelected = formData.role === occupancy.role;
                          return (
                            <div key={occupancy.role} className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors", isSelected && "ring-1 ring-primary bg-primary/5", isFull ? "bg-danger/10 text-danger" : "bg-background")}>
                              <span className={cn("font-medium truncate", isFull && "text-danger")}>{occupancy.label}</span>
                              <span className={cn("font-mono font-semibold ml-2", isFull ? "text-danger" : "text-foreground")}>{occupancy.current}/{occupancy.max}</span>
                            </div>
                          );
                        })}
                      </div>
                      {formData.role && selectedGroup.roleOccupancy.find(o => o.role === formData.role && o.current >= o.max) && (
                        <p className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />Não há vagas disponíveis para este cargo neste grupo</p>
                      )}
                    </div>
                  )}

                  {!isCoringa && formData.group_id && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">Squad <span className="text-danger">*</span></label>
                      <select value={formData.squad_id} onChange={(e) => setFormData(prev => ({ ...prev, squad_id: e.target.value }))} disabled={isLoading || !selectedGroup?.squads?.length}
                        className={cn("input-apple", errors.squad_id && "border-danger focus:ring-danger/30", !formData.squad_id && "text-muted-foreground")}>
                        <option value="">Selecione um squad</option>
                        {selectedGroup?.squads?.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
                      </select>
                      {errors.squad_id && <p className="text-xs text-danger">{errors.squad_id}</p>}
                      {selectedGroup && !selectedGroup.squads?.length && <p className="text-xs text-muted-foreground">Nenhum squad disponível neste grupo</p>}
                    </div>
                  )}
                </>
              )}

              {/* Campos para Cargos Independentes */}
              {assignmentType === 'independent' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Área Independente <span className="text-danger">*</span></label>
                  <select value={formData.category_id} onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))} disabled={isLoading}
                    className={cn("input-apple", errors.category_id && "border-danger focus:ring-danger/30", !formData.category_id && "text-muted-foreground")}>
                    <option value="">Selecione uma área</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  {errors.category_id && <p className="text-xs text-danger">{errors.category_id}</p>}
                </div>
              )}
              </>)}

              {/* Páginas de Acesso (só no modo padrão) */}
              {formData.role && accessMode === 'standard' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground flex items-center gap-2"><FileText size={14} />Páginas de Acesso</label>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Páginas padrão do cargo:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {defaultPages.length > 0 ? defaultPages.map(pageId => {
                        const page = ALL_PAGES.find(p => p.id === pageId);
                        if (!page) return null;
                        return <Badge key={pageId} variant="secondary" className="text-xs py-1 px-2 bg-primary/10 text-primary border-primary/20"><span className="mr-1">{page.icon}</span>{page.label}</Badge>;
                      }) : <span className="text-xs text-muted-foreground">Nenhuma página padrão</span>}
                    </div>
                  </div>
                  {availableAdditionalPages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Páginas adicionais (opcional):</p>
                      <ScrollArea className="h-[120px] border rounded-xl p-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          {availableAdditionalPages.map(page => {
                            const isSelected = additionalPages.includes(page.id);
                            return (
                              <button key={page.id} type="button" onClick={() => toggleAdditionalPage(page.id)} className={cn(
                                "flex items-center gap-2 p-2 rounded-lg text-xs text-left transition-colors",
                                isSelected ? "bg-primary/10 border border-primary/30 text-primary" : "bg-muted/50 border border-transparent hover:bg-muted"
                              )}>
                                {isSelected ? <Check size={12} className="text-primary flex-shrink-0" /> : <div className="w-3 h-3 rounded border border-muted-foreground/30 flex-shrink-0" />}
                                <span className="mr-1">{page.icon}</span><span className="truncate">{page.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      {additionalPages.length > 0 && <p className="text-xs text-muted-foreground">{additionalPages.length} página(s) adicional(is) selecionada(s)</p>}
                    </div>
                  )}
                </div>
              )}

              {/* ═══ ACESSO A MÓDULOS ═══ */}
              <div className="space-y-2 pt-4 border-t border-border">
                <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield size={14} />
                  Acesso a módulos
                </label>
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                    effectiveMtechAccess
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/30 border-border hover:bg-muted/50",
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
                <button type="button" onClick={handleClose} disabled={isLoading} className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isLoading} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-semibold uppercase text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2">
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  Criar Usuário
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
