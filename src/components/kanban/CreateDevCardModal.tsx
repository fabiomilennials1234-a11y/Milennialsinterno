import { useEffect, useState, useRef } from 'react';
import { X, Loader2, Upload, FileText, Trash2, Image as ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingAttachment {
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

interface CreateDevCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any, attachments?: PendingAttachment[]) => void;
  isLoading?: boolean;
  devColumns: { id: string; title: string }[];
}

export default function CreateDevCardModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  devColumns,
}: CreateDevCardModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    column_id: '',
    priority: 'normal' as 'normal' | 'urgent',
    due_date: '',
    status: 'a_fazer',
    materials_url: '',
  });

  const cleanupPreviews = (attachments: PendingAttachment[]) => {
    attachments.forEach(att => {
      if (att.preview) URL.revokeObjectURL(att.preview);
    });
  };

  // When the modal closes (including when parent sets isOpen=false on success),
  // cleanup previews and reset local state.
  useEffect(() => {
    if (isOpen) return;
    cleanupPreviews(pendingAttachments);
    setPendingAttachments([]);
    setFormData({
      title: '',
      description: '',
      column_id: '',
      priority: 'normal',
      due_date: '',
      status: 'a_fazer',
      materials_url: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: PendingAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attachment: PendingAttachment = {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      };
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        attachment.preview = URL.createObjectURL(file);
      }
      
      newAttachments.push(attachment);
    }

    setPendingAttachments(prev => [...prev, ...newAttachments]);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => {
      const attachment = prev[index];
      // Revoke object URL if exists
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={16} className="text-success" />;
    if (type.startsWith('video/')) return <Video size={16} className="text-info" />;
    return <FileText size={16} className="text-primary" />;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim() || !formData.column_id || !formData.due_date) return;
    
    console.log('Submitting with attachments:', pendingAttachments.length);
    onSubmit(formData, pendingAttachments);
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  const priorityOptions = [
    { value: 'normal', label: 'Normal', color: 'bg-info/20 text-info' },
    { value: 'urgent', label: '🔥 Urgente', color: 'bg-danger/20 text-danger' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />
      
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-display text-xl font-bold text-foreground">
            Nova Demanda de Desenvolvimento
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 scrollbar-elegant">
          <div className="space-y-5">
            {/* Title - Required */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Nome da demanda <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Desenvolver funcionalidade X"
                className="input-apple"
                required
              />
            </div>

            {/* Description - Required */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Descrição da demanda <span className="text-danger">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva detalhadamente o que precisa ser desenvolvido..."
                rows={4}
                className="input-apple resize-none"
                required
              />
            </div>

            {/* Dev Column - Required */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Desenvolvedor responsável <span className="text-danger">*</span>
              </label>
              <select
                value={formData.column_id}
                onChange={e => setFormData(prev => ({ ...prev, column_id: e.target.value }))}
                className="input-apple"
                required
              >
                <option value="">Selecione o desenvolvedor...</option>
                {devColumns.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.title.replace('BY ', '')}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority & Due Date Row - Both Required */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Prioridade <span className="text-danger">*</span>
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
                  Prazo <span className="text-danger">*</span>
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

            {/* Separator - Optional Fields */}
            <div className="border-t border-border pt-5">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Campos Opcionais
              </h3>
            </div>

            {/* Materials URL - Optional */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Materiais e recursos (links)
              </label>
              <input
                type="url"
                value={formData.materials_url}
                onChange={e => setFormData(prev => ({ ...prev, materials_url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="input-apple"
              />
            </div>

            {/* Attachments Section - Optional */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Anexos {pendingAttachments.length > 0 && <span className="text-muted-foreground">({pendingAttachments.length} arquivo{pendingAttachments.length > 1 ? 's' : ''})</span>}
              </label>
              
              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar arquivos
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Imagens, vídeos, PDFs e documentos
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
              />

              {/* Pending Attachments List */}
              {pendingAttachments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {pendingAttachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      {/* Thumbnail or Icon */}
                      {attachment.preview ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                          <img 
                            src={attachment.preview} 
                            alt={attachment.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {getFileIcon(attachment.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !formData.title.trim() || !formData.description.trim() || !formData.column_id || !formData.due_date}
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
