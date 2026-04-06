import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  clientId: string;
  originalName: string;
  financeDisplayName: string | null;
  className?: string;
  onNameClick?: () => void;
}

export default function FinanceDisplayName({ clientId, originalName, financeDisplayName, className, onNameClick }: Props) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(financeDisplayName || '');
  const [isSaving, setIsSaving] = useState(false);

  const displayName = financeDisplayName || originalName;
  const hasCustomName = !!financeDisplayName;

  const handleSave = async () => {
    const trimmed = editValue.trim();
    const newValue = trimmed === '' || trimmed === originalName ? null : trimmed;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ finance_display_name: newValue })
        .eq('id', clientId);

      if (error) throw error;

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });

      setIsEditing(false);
      toast.success(newValue ? 'Nome financeiro atualizado' : 'Nome financeiro removido');
    } catch {
      toast.error('Erro ao salvar nome');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(financeDisplayName || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-6 text-sm px-1.5 w-36"
          placeholder={originalName}
          maxLength={100}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-emerald-600 hover:text-emerald-700"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Check size={12} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-muted-foreground hover:text-destructive"
          onClick={handleCancel}
        >
          <X size={12} />
        </Button>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {hasCustomName ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn("font-medium italic", onNameClick && "cursor-pointer hover:text-primary transition-colors")}
                onClick={onNameClick}
              >
                {displayName}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Nome original: {originalName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span
          className={cn("font-medium", onNameClick && "cursor-pointer hover:text-primary transition-colors")}
          onClick={onNameClick}
        >
          {displayName}
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setEditValue(financeDisplayName || '');
          setIsEditing(true);
        }}
      >
        <Pencil size={10} />
      </Button>
    </span>
  );
}
