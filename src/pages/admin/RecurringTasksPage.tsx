import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, UserRole } from '@/types/auth';
import { Loader2, Plus, Play, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import {
  useRecurringTemplates,
  useCreateRecurringTemplate,
  useUpdateRecurringTemplate,
  useDeleteRecurringTemplate,
  useGenerateRecurringTasks,
  RecurringTemplate,
} from '@/hooks/useRecurringTemplates';

// Role -> department mapping. In this codebase, department = role name.
const ROLE_DEPARTMENT: Record<UserRole, string> = {
  ceo: 'ceo',
  cto: 'cto',
  gestor_projetos: 'gestor_projetos',
  gestor_ads: 'gestor_ads',
  outbound: 'outbound',
  sucesso_cliente: 'sucesso_cliente',
  design: 'design',
  editor_video: 'editor_video',
  devs: 'devs',
  produtora: 'produtora',
  gestor_crm: 'gestor_crm',
  consultor_comercial: 'consultor_comercial',
  consultor_mktplace: 'consultor_mktplace',
  financeiro: 'financeiro',
  rh: 'rh',
};

const AVAILABLE_ROLES: UserRole[] = [
  'ceo',
  'cto',
  'gestor_projetos',
  'gestor_ads',
  'outbound',
  'sucesso_cliente',
  'design',
  'editor_video',
  'devs',
  'produtora',
  'gestor_crm',
  'consultor_comercial',
  'consultor_mktplace',
  'financeiro',
  'rh',
];

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekly_monday', label: 'Segunda-feira' },
  { value: 'weekly_tuesday', label: 'Terça-feira' },
  { value: 'weekly_wednesday', label: 'Quarta-feira' },
  { value: 'weekly_thursday', label: 'Quinta-feira' },
  { value: 'weekly_friday', label: 'Sexta-feira' },
] as const;

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Diária',
  weekly_monday: 'Segunda-feira',
  weekly_tuesday: 'Terça-feira',
  weekly_wednesday: 'Quarta-feira',
  weekly_thursday: 'Quinta-feira',
  weekly_friday: 'Sexta-feira',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
] as const;

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const TASK_TYPE_OPTIONS = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
] as const;

interface FormData {
  title: string;
  description: string;
  target_role: UserRole | '';
  recurrence: string;
  task_type: string;
  priority: string;
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  target_role: '',
  recurrence: 'daily',
  task_type: 'daily',
  priority: 'normal',
};

export default function RecurringTasksPage() {
  const { isAdminUser } = useAuth();
  const { data: templates = [], isLoading, error } = useRecurringTemplates();
  const createTemplate = useCreateRecurringTemplate();
  const updateTemplate = useUpdateRecurringTemplate();
  const deleteTemplate = useDeleteRecurringTemplate();
  const generateTasks = useGenerateRecurringTasks();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (!isAdminUser) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h2 className="font-display text-xl font-bold text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground mt-2">Somente administradores podem acessar esta pagina.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (t: RecurringTemplate) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description ?? '',
      target_role: t.target_role as UserRole,
      recurrence: t.recurrence,
      task_type: t.task_type,
      priority: t.priority,
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Titulo obrigatorio';
    if (!form.target_role) newErrors.target_role = 'Cargo obrigatorio';
    if (!form.recurrence) newErrors.recurrence = 'Recorrencia obrigatoria';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const role = form.target_role as UserRole;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      department: ROLE_DEPARTMENT[role],
      target_role: role,
      recurrence: form.recurrence,
      task_type: form.task_type,
      priority: form.priority,
    };

    if (editingId) {
      await updateTemplate.mutateAsync({ id: editingId, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    setModalOpen(false);
  };

  const handleToggleActive = (t: RecurringTemplate) => {
    updateTemplate.mutate({ id: t.id, is_active: !t.is_active });
  };

  const handleDelete = (id: string) => {
    deleteTemplate.mutate(id);
    setDeleteConfirm(null);
  };

  const isMutating = createTemplate.isPending || updateTemplate.isPending;

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
            <h2 className="font-display text-xl font-bold text-danger">Erro ao carregar templates</h2>
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
              Tarefas Recorrentes
            </h1>
            <p className="text-muted-foreground mt-1">
              {templates.length} template{templates.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => generateTasks.mutate()}
              disabled={generateTasks.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                       border border-border text-foreground font-display font-semibold text-sm
                       hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {generateTasks.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              Gerar Agora
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-primary text-primary-foreground font-display font-semibold uppercase text-sm
                       hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Plus size={18} />
              Nova Tarefa Recorrente
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card-apple overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Titulo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Cargo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Recorrencia
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Prioridade
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Ativo
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      Nenhum template criado
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-foreground">{t.title}</p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">
                              {t.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          {ROLE_LABELS[t.target_role as UserRole] ?? t.target_role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">
                        {RECURRENCE_LABELS[t.recurrence] ?? t.recurrence}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium",
                          t.priority === 'urgent' && "bg-destructive/15 text-destructive",
                          t.priority === 'high' && "bg-warning/15 text-warning",
                          t.priority === 'normal' && "bg-muted text-muted-foreground",
                          t.priority === 'low' && "bg-muted/50 text-muted-foreground/70",
                        )}>
                          {PRIORITY_LABELS[t.priority] ?? t.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground capitalize">
                        {t.task_type === 'daily' ? 'Diaria' : 'Semanal'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Switch
                          checked={t.is_active}
                          onCheckedChange={() => handleToggleActive(t)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(t)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(t.id)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
            onClick={() => !isMutating && setModalOpen(false)}
          />
          <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
                {editingId ? 'Editar Template' : 'Nova Tarefa Recorrente'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                disabled={isMutating}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Titulo *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className={cn("input-apple w-full", errors.title && "border-destructive")}
                  placeholder="Ex: Preencher relatorio diario"
                />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Descricao</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input-apple w-full min-h-[80px] resize-y"
                  placeholder="Descricao detalhada da tarefa (opcional)"
                  rows={3}
                />
              </div>

              {/* Target Role */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Cargo-alvo *</label>
                <select
                  value={form.target_role}
                  onChange={(e) => setForm(prev => ({ ...prev, target_role: e.target.value as UserRole }))}
                  className={cn("input-apple w-full", errors.target_role && "border-destructive")}
                >
                  <option value="">Selecione um cargo</option>
                  {AVAILABLE_ROLES.map(role => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
                {form.target_role && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Departamento: {ROLE_DEPARTMENT[form.target_role as UserRole]}
                  </p>
                )}
                {errors.target_role && <p className="text-xs text-destructive mt-1">{errors.target_role}</p>}
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Recorrencia *</label>
                <select
                  value={form.recurrence}
                  onChange={(e) => setForm(prev => ({ ...prev, recurrence: e.target.value }))}
                  className={cn("input-apple w-full", errors.recurrence && "border-destructive")}
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.recurrence && <p className="text-xs text-destructive mt-1">{errors.recurrence}</p>}
              </div>

              {/* Task Type + Priority side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tipo de Tarefa</label>
                  <select
                    value={form.task_type}
                    onChange={(e) => setForm(prev => ({ ...prev, task_type: e.target.value }))}
                    className="input-apple w-full"
                  >
                    {TASK_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Prioridade</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-apple w-full"
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isMutating}
                  className="px-5 py-2.5 rounded-xl border border-border text-foreground font-display font-semibold text-sm
                           hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                           bg-primary text-primary-foreground font-display font-semibold uppercase text-sm
                           hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isMutating && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative w-full max-w-sm mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border p-6">
            <h3 className="font-display text-lg font-bold text-foreground">Excluir template?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Essa acao nao pode ser desfeita. Tarefas ja geradas nao serao afetadas.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl border border-border text-foreground text-sm font-medium
                         hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteTemplate.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                         bg-destructive text-destructive-foreground text-sm font-medium
                         hover:brightness-105 transition-all disabled:opacity-50"
              >
                {deleteTemplate.isPending && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
