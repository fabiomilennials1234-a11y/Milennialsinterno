import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlignLeft, 
  Tag, 
  Calendar, 
  Clock,
  Plus,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProToolContentView from './ProToolContentView';
import AdsBonusTableView from './AdsBonusTableView';

interface CardData {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  dueDate?: string;
  createdAt?: string;
  listName?: string;
}

interface AdsCardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardData | null;
  onSave?: (data: Partial<CardData>) => void;
  listName?: string;
  readOnly?: boolean;
}

const AVAILABLE_TAGS = [
  { label: 'Urgente', color: 'bg-danger/80' },
  { label: 'Em Progresso', color: 'bg-warning/80' },
  { label: 'Concluído', color: 'bg-success/80' },
  { label: 'Pendente', color: 'bg-info/80' },
  { label: 'Prioridade', color: 'bg-primary' },
];

export default function AdsCardDetailModal({ 
  isOpen, 
  onClose, 
  card, 
  onSave,
  listName,
  readOnly = false
}: AdsCardDetailModalProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [title, setTitle] = useState(card?.title || '');
  const [description, setDescription] = useState(card?.description || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(card?.tags || []);
  const [dueDate, setDueDate] = useState(card?.dueDate || '');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const syncDescriptionHeight = () => {
    const el = descriptionRef.current;
    if (!el) return;

    el.style.height = 'auto';
    const maxHeight = 420;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    if (!isEditingDescription) return;
    requestAnimationFrame(syncDescriptionHeight);
  }, [isEditingDescription, description, isOpen, card?.id]);

  // Important: reset local state whenever a different card is opened
  useEffect(() => {
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setTitle(card?.title || '');
    setDescription(card?.description || '');
    setSelectedTags(card?.tags || []);
    setDueDate(card?.dueDate || '');
    setShowTagPicker(false);
    setShowDatePicker(false);
  }, [card?.id, isOpen]);

  // Calculate card age
  const cardAge = card?.createdAt 
    ? Math.floor((new Date().getTime() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    onSave?.({ title });
  };

  const handleSaveDescription = () => {
    setIsEditingDescription(false);
    onSave?.({ description });
  };

  const handleToggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    onSave?.({ tags: newTags });
  };

  const handleSetDueDate = (date: string) => {
    setDueDate(date);
    setShowDatePicker(false);
    onSave?.({ dueDate: date });
  };

  if (!card) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 bg-card border-subtle overflow-hidden max-h-[90vh] shadow-apple-lg">
        <DialogTitle className="sr-only">{title || card.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Detalhes do card {listName ? `da lista ${listName}` : ''}
        </DialogDescription>
        {/* Header */}
        <div className="p-6 border-b border-subtle">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {listName && (
                <span className="inline-block text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md mb-3">
                  {listName}
                </span>
              )}
              {isEditingTitle && !readOnly ? (
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                  className="text-xl font-semibold input-apple"
                  autoFocus
                />
              ) : (
                <h2 
                  className={cn(
                    "text-xl font-semibold text-foreground px-3 py-2 -mx-3 rounded-xl transition-colors",
                    !readOnly && "cursor-pointer hover:bg-muted/30"
                  )}
                  onClick={() => !readOnly && setIsEditingTitle(true)}
                >
                  {title || card.title}
                </h2>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh] scrollbar-apple">
          {/* Quick Actions - Hidden in readOnly mode */}
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="text-sm border-subtle text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => setIsEditingDescription(true)}
              >
                <Plus size={14} className="mr-1.5" />
                Adicionar
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-sm border-subtle text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => setShowTagPicker(!showTagPicker)}
              >
                <Tag size={14} className="mr-1.5" />
                Etiquetas
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-sm border-subtle text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                <Calendar size={14} className="mr-1.5" />
                Datas
              </Button>
            </div>
          )}

          {/* Tag Picker */}
          {showTagPicker && (
            <div className="p-4 bg-muted/30 rounded-xl border border-subtle space-y-3">
              <h4 className="text-sm font-medium text-foreground">Selecionar Etiquetas</h4>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map(tag => (
                  <button
                    key={tag.label}
                    onClick={() => handleToggleTag(tag.label)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all',
                      tag.color,
                      selectedTags.includes(tag.label) && 'ring-2 ring-foreground/20 ring-offset-2 ring-offset-background'
                    )}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Picker */}
          {showDatePicker && (
            <div className="p-4 bg-muted/30 rounded-xl border border-subtle space-y-3">
              <h4 className="text-sm font-medium text-foreground">Data de Entrega</h4>
              <Input
                type="date"
                value={dueDate}
                onChange={e => handleSetDueDate(e.target.value)}
                className="input-apple"
              />
            </div>
          )}

          {/* Meta Info Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Selected Tags Display */}
            {selectedTags.length > 0 && selectedTags.map(tag => {
              const tagConfig = AVAILABLE_TAGS.find(t => t.label === tag);
              return (
                <span
                  key={tag}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium text-white',
                    tagConfig?.color || 'bg-muted'
                  )}
                >
                  {tag}
                </span>
              );
            })}

            {/* Due Date Display */}
            {dueDate && (
              <div className="flex items-center gap-2 text-sm text-foreground bg-muted/30 px-3 py-1.5 rounded-lg">
                <Calendar size={14} className="text-muted-foreground" />
                <span>Entrega: {format(new Date(dueDate), "dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
            )}

            {/* Card Age */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-info/10 text-info rounded-lg text-xs font-medium">
              <Clock size={12} />
              {cardAge} dias
            </div>
          </div>

          {/* Description - Enhanced for PRO+ Tools */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {readOnly ? (
                <Sparkles size={16} className="text-primary" />
              ) : (
                <AlignLeft size={16} className="text-muted-foreground" />
              )}
              {readOnly ? 'Conteúdo' : 'Descrição'}
            </div>
            {isEditingDescription && !readOnly ? (
              <div className="space-y-3">
                <Textarea
                  ref={descriptionRef}
                  value={description}
                  onChange={e => {
                    setDescription(e.target.value);
                    requestAnimationFrame(syncDescriptionHeight);
                  }}
                  placeholder="Adicione uma descrição mais detalhada..."
                  className="input-apple min-h-[200px] resize-none overflow-hidden break-all text-base leading-relaxed"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="btn-cta text-xs" onClick={handleSaveDescription}>
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setIsEditingDescription(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className={cn(
                  "p-5 rounded-xl min-h-[180px] border transition-colors",
                  readOnly 
                    ? "bg-gradient-to-br from-primary/5 via-background to-primary/5 border-primary/20" 
                    : "bg-muted/20 border-subtle cursor-pointer hover:bg-muted/30"
                )}
                onClick={() => !readOnly && setIsEditingDescription(true)}
              >
                {description ? (
                  readOnly ? (
                    card.id === 'tabela_bonus' ? (
                      <AdsBonusTableView />
                    ) : (
                      <ProToolContentView content={description} />
                    )
                  ) : (
                    <p className="text-base text-foreground whitespace-pre-wrap break-words leading-relaxed">{description}</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {readOnly ? 'Sem conteúdo disponível' : 'Adicione uma descrição mais detalhada...'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
