import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
  }) => void;
  isLoading?: boolean;
}

export default function CreateCardModal({ isOpen, onClose, onSubmit, isLoading }: CreateCardModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Título é obrigatório';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSubmit({
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority,
      due_date: formData.due_date || undefined,
    });

    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
    });
    setErrors({});
  };

  const handleClose = () => {
    if (isLoading) return;
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />
      
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
            Nova Tarefa
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Título */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Título
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Digite o título da tarefa"
              disabled={isLoading}
              className={cn(
                "input-apple",
                errors.title && "border-danger focus:ring-danger/30"
              )}
            />
            {errors.title && (
              <p className="text-xs text-danger">{errors.title}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Descrição (opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva a tarefa..."
              disabled={isLoading}
              rows={3}
              className="input-apple resize-none"
            />
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Prioridade
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'low', label: 'Baixa', color: 'bg-success/10 text-success border-success/30' },
                { value: 'medium', label: 'Média', color: 'bg-info/10 text-info border-info/30' },
                { value: 'high', label: 'Alta', color: 'bg-warning/10 text-warning border-warning/30' },
                { value: 'urgent', label: 'Urgente', color: 'bg-danger/10 text-danger border-danger/30' },
              ].map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority.value as typeof formData.priority }))}
                  disabled={isLoading}
                  className={cn(
                    "py-2 px-3 rounded-lg text-xs font-medium border transition-all",
                    formData.priority === priority.value
                      ? priority.color
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data de entrega */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Data de Entrega (opcional)
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              disabled={isLoading}
              className="input-apple"
            />
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
              Criar Tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
