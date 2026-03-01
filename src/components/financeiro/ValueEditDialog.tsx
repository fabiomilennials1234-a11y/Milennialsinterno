import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle } from 'lucide-react';

interface ValueEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue: number;
  productName: string;
  clientName: string;
  onConfirm: (params: {
    newValue: number;
    scope: 'single_month' | 'all_following';
    justification: string;
  }) => void;
  isPending?: boolean;
}

export default function ValueEditDialog({
  open,
  onOpenChange,
  currentValue,
  productName,
  clientName,
  onConfirm,
  isPending,
}: ValueEditDialogProps) {
  const [newValue, setNewValue] = useState(currentValue.toFixed(2).replace('.', ','));
  const [scope, setScope] = useState<'single_month' | 'all_following'>('single_month');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    const numericValue = parseFloat(newValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(numericValue) || numericValue < 0) {
      setError('Informe um valor valido');
      return;
    }
    if (justification.trim().length < 10) {
      setError('A justificativa deve ter pelo menos 10 caracteres');
      return;
    }
    setError('');
    onConfirm({
      newValue: numericValue,
      scope,
      justification: justification.trim(),
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNewValue(currentValue.toFixed(2).replace('.', ','));
      setScope('single_month');
      setJustification('');
      setError('');
    }
    onOpenChange(isOpen);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar Valor</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {clientName} — {productName}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current value */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valor atual:</span>
            <span className="font-semibold">{formatCurrency(currentValue)}</span>
          </div>

          {/* New value */}
          <div className="space-y-1.5">
            <Label htmlFor="new-value">Novo valor</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                id="new-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label>Aplicar alteracao em:</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as 'single_month' | 'all_following')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="single_month" id="scope-single" />
                <Label htmlFor="scope-single" className="cursor-pointer font-normal">
                  Somente este mes
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="all_following" id="scope-all" />
                <Label htmlFor="scope-all" className="cursor-pointer font-normal">
                  Este mes e todos os seguintes
                </Label>
              </div>
            </RadioGroup>
            {scope === 'all_following' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle size={12} />
                Isso atualizara o valor base do produto para cobranças futuras
              </p>
            )}
          </div>

          {/* Justification */}
          <div className="space-y-1.5">
            <Label htmlFor="justification">Justificativa *</Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explique o motivo da alteracao do valor..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {justification.length}/500
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle size={14} />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
