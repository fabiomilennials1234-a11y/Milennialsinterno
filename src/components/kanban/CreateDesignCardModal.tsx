import { useState, useEffect } from 'react';
import { X, Loader2, User, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface CreateDesignCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority?: 'normal' | 'urgent';
    due_date?: string;
    column_id?: string;
    status?: string;
    briefing?: {
      description?: string;
      references_url?: string;
      identity_url?: string;
      client_instagram?: string;
      script_url?: string;
    };
  }) => void;
  isLoading?: boolean;
  designerColumns?: { id: string; title: string }[];
}

export default function CreateDesignCardModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading,
  designerColumns = []
}: CreateDesignCardModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    column_id: '',
    priority: 'normal' as 'normal' | 'urgent',
    due_date: undefined as Date | undefined,
  });
  
  const [briefingData, setBriefingData] = useState({
    description: '',
    references_url: '',
    identity_url: '',
    client_instagram: '',
    script_url: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Set default column when columns load
  useEffect(() => {
    if (designerColumns.length > 0 && !formData.column_id) {
      setFormData(prev => ({ ...prev, column_id: designerColumns[0].id }));
    }
  }, [designerColumns]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Título é obrigatório';
    }
    
    if (!formData.column_id) {
      newErrors.column_id = 'Selecione o designer responsável';
    }

    if (!formData.due_date) {
      newErrors.due_date = 'Prazo é obrigatório';
    }

    if (!briefingData.description.trim()) {
      newErrors.description = 'Descrição das artes é obrigatória';
    }

    if (!briefingData.references_url.trim()) {
      newErrors.references_url = 'Link de referências é obrigatório';
    }

    if (!briefingData.identity_url.trim()) {
      newErrors.identity_url = 'Link da identidade visual é obrigatório';
    }

    if (!briefingData.client_instagram.trim()) {
      newErrors.client_instagram = '@ do cliente é obrigatório';
    }

    if (!briefingData.script_url.trim()) {
      newErrors.script_url = 'Roteiro é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSubmit({
      title: formData.title,
      column_id: formData.column_id,
      priority: formData.priority,
      due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : undefined,
      status: 'a_fazer', // Default status for new design cards
      briefing: {
        description: briefingData.description,
        references_url: briefingData.references_url,
        identity_url: briefingData.identity_url,
        client_instagram: briefingData.client_instagram,
        script_url: briefingData.script_url,
      },
    });

    // Reset form
    setFormData({
      title: '',
      column_id: designerColumns[0]?.id || '',
      priority: 'normal',
      due_date: undefined,
    });
    setBriefingData({
      description: '',
      references_url: '',
      identity_url: '',
      client_instagram: '',
      script_url: '',
    });
    setErrors({});
  };

  const handleClose = () => {
    if (isLoading) return;
    setFormData({
      title: '',
      column_id: designerColumns[0]?.id || '',
      priority: 'normal',
      due_date: undefined,
    });
    setBriefingData({
      description: '',
      references_url: '',
      identity_url: '',
      client_instagram: '',
      script_url: '',
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
      
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
            Criar Card Modelo
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-elegant">
          {/* Título */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Título do Card *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Criativos para campanha de vendas"
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

          {/* Designer Responsável */}
          {designerColumns.length > 1 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Designer Responsável *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {designerColumns.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, column_id: col.id }))}
                    disabled={isLoading}
                    className={cn(
                      "flex items-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all",
                      formData.column_id === col.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <User size={16} />
                    {col.title.replace('BY ', '')}
                  </button>
                ))}
              </div>
              {errors.column_id && (
                <p className="text-xs text-danger">{errors.column_id}</p>
              )}
            </div>
          )}

          {/* Prazo */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Prazo *
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isLoading}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.due_date && "text-muted-foreground",
                    errors.due_date && "border-danger"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? (
                    format(formData.due_date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione o prazo</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {errors.due_date && (
              <p className="text-xs text-danger">{errors.due_date}</p>
            )}
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Prioridade *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, priority: 'normal' }))}
                disabled={isLoading}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all",
                  formData.priority === 'normal'
                    ? "border-info bg-info/10 text-info"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                )}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, priority: 'urgent' }))}
                disabled={isLoading}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all",
                  formData.priority === 'urgent'
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                )}
              >
                🔥 Urgente
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground font-medium tracking-wider">
                Briefing
              </span>
            </div>
          </div>

          {/* Briefing Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Descrição das artes *
              </label>
              <textarea
                value={briefingData.description}
                onChange={(e) => setBriefingData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Escreva os detalhes importantes na arte"
                disabled={isLoading}
                rows={3}
                className={cn("input-apple resize-none", errors.description && "border-danger")}
              />
              {errors.description && (
                <p className="text-xs text-danger">{errors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Referências *
              </label>
              <input
                type="text"
                value={briefingData.references_url}
                onChange={(e) => setBriefingData(prev => ({ ...prev, references_url: e.target.value }))}
                placeholder="Coloque aqui o link de referências"
                disabled={isLoading}
                className={cn("input-apple", errors.references_url && "border-danger")}
              />
              {errors.references_url && (
                <p className="text-xs text-danger">{errors.references_url}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Identidade visual do cliente *
              </label>
              <input
                type="text"
                value={briefingData.identity_url}
                onChange={(e) => setBriefingData(prev => ({ ...prev, identity_url: e.target.value }))}
                placeholder="Coloque aqui o link da identidade visual do cliente"
                disabled={isLoading}
                className={cn("input-apple", errors.identity_url && "border-danger")}
              />
              {errors.identity_url && (
                <p className="text-xs text-danger">{errors.identity_url}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Qual é o @ do cliente no Instagram *
              </label>
              <input
                type="text"
                value={briefingData.client_instagram}
                onChange={(e) => setBriefingData(prev => ({ ...prev, client_instagram: e.target.value }))}
                placeholder="Coloque o @ do cliente"
                disabled={isLoading}
                className={cn("input-apple", errors.client_instagram && "border-danger")}
              />
              {errors.client_instagram && (
                <p className="text-xs text-danger">{errors.client_instagram}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Roteiro para as artes *
              </label>
              <textarea
                value={briefingData.script_url}
                onChange={(e) => setBriefingData(prev => ({ ...prev, script_url: e.target.value }))}
                placeholder="Escreva o roteiro para as artes aqui..."
                disabled={isLoading}
                rows={4}
                className={cn("input-apple resize-none", errors.script_url && "border-danger")}
              />
              {errors.script_url && (
                <p className="text-xs text-danger">{errors.script_url}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
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
              Criar Card Modelo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
