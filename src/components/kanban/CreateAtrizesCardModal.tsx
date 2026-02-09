import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ATRIZES_STATUSES } from '@/hooks/useAtrizesKanban';

interface CreateAtrizesCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
  atrizColumns: { id: string; title: string }[];
}

export default function CreateAtrizesCardModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  atrizColumns,
}: CreateAtrizesCardModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    column_id: '',
    priority: 'normal' as 'normal' | 'urgent',
    due_date: '',
    status: 'a_fazer',
    briefing: {
      client_instagram: '',
      script_url: '',
      drive_upload_url: '',
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.column_id) return;
    onSubmit(formData);
    // Reset form
    setFormData({
      title: '',
      column_id: '',
      priority: 'normal',
      due_date: '',
      status: 'a_fazer',
      briefing: {
        client_instagram: '',
        script_url: '',
        drive_upload_url: '',
      },
    });
  };

  if (!isOpen) return null;

  const priorityOptions = [
    { value: 'normal', label: 'Normal', color: 'bg-info/20 text-info' },
    { value: 'urgent', label: 'Urgente', color: 'bg-danger/20 text-danger' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-display text-xl font-bold text-foreground">
            Nova Demanda de Gravação
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Título da demanda *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Gravação anúncio cliente X"
                className="input-apple"
                required
              />
            </div>

            {/* Atriz Column */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Atriz responsável *
              </label>
              <select
                value={formData.column_id}
                onChange={e => setFormData(prev => ({ ...prev, column_id: e.target.value }))}
                className="input-apple"
                required
              >
                <option value="">Selecione a atriz...</option>
                {atrizColumns.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.title.replace('BY ', '')}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority & Due Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Prioridade
                </label>
                <div className="flex flex-wrap gap-2">
                  {priorityOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: opt.value as any }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        formData.priority === opt.value
                          ? opt.color + " ring-2 ring-offset-2 ring-offset-card"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Data de entrega *
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  className="input-apple"
                  required
                />
              </div>
            </div>

            {/* Status Initial */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Status inicial
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="input-apple"
              >
                {ATRIZES_STATUSES.map(status => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Separator */}
            <div className="border-t border-border pt-5">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Briefing da Gravação
              </h3>
            </div>

            {/* Client Instagram */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Instagram do cliente
              </label>
              <input
                type="text"
                value={formData.briefing.client_instagram}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  briefing: { ...prev.briefing, client_instagram: e.target.value }
                }))}
                placeholder="@cliente"
                className="input-apple"
              />
            </div>

            {/* Script URL */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Roteiro de anúncios
              </label>
              <input
                type="url"
                value={formData.briefing.script_url}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  briefing: { ...prev.briefing, script_url: e.target.value }
                }))}
                placeholder="https://docs.google.com/..."
                className="input-apple"
              />
            </div>

            {/* Drive Upload URL */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Drive para subir o vídeo
              </label>
              <input
                type="url"
                value={formData.briefing.drive_upload_url}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  briefing: { ...prev.briefing, drive_upload_url: e.target.value }
                }))}
                placeholder="https://drive.google.com/..."
                className="input-apple"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !formData.title.trim() || !formData.column_id || !formData.due_date}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Criar Demanda
          </button>
        </div>
      </div>
    </div>
  );
}
