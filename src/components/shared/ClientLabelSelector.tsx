import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tag, Star, ThumbsUp, Minus, ThumbsDown, X } from 'lucide-react';
import { useUpdateClientLabel } from '@/hooks/useClientLabel';
import type { ClientLabel } from '@/components/shared/ClientLabelBadge';
import { cn } from '@/lib/utils';

interface ClientLabelSelectorProps {
  clientId: string;
  currentLabel: ClientLabel;
  onSelect?: (label: ClientLabel) => void;
}

const LABEL_OPTIONS: Array<{
  value: Exclude<ClientLabel, null>;
  label: string;
  icon: React.ElementType;
  className: string;
}> = [
  { value: 'otimo', label: 'Ótimo', icon: Star, className: 'text-success' },
  { value: 'bom', label: 'Bom', icon: ThumbsUp, className: 'text-info' },
  { value: 'medio', label: 'Médio', icon: Minus, className: 'text-warning' },
  { value: 'ruim', label: 'Ruim', icon: ThumbsDown, className: 'text-destructive' },
];

export default function ClientLabelSelector({ clientId, currentLabel, onSelect }: ClientLabelSelectorProps) {
  const updateLabel = useUpdateClientLabel();

  const handleSelect = (label: ClientLabel) => {
    updateLabel.mutate({ clientId, label, previousLabel: currentLabel });
    onSelect?.(label);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Definir etiqueta"
        >
          <Tag className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {LABEL_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = currentLabel === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(isSelected && 'bg-accent')}
            >
              <Icon className={cn('h-4 w-4 mr-2', option.className)} />
              {option.label}
            </DropdownMenuItem>
          );
        })}
        {currentLabel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSelect(null)}>
              <X className="h-4 w-4 mr-2 text-muted-foreground" />
              Remover etiqueta
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
