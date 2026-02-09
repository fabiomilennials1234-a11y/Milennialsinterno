import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOKRs } from '@/hooks/useOKRs';
import { Loader2 } from 'lucide-react';

interface OKRCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'annual' | 'weekly';
}

export default function OKRCreateModal({ open, onOpenChange, type }: OKRCreateModalProps) {
  const { createOKR } = useOKRs();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    await createOKR.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      type,
      target_value: targetValue ? parseFloat(targetValue) : null,
      current_value: currentValue ? parseFloat(currentValue) : null,
      end_date: endDate || null,
      status: 'active',
    });

    setTitle('');
    setDescription('');
    setTargetValue('');
    setCurrentValue('');
    setEndDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Criar OKR {type === 'annual' ? 'Anual' : 'Semanal'}
          </DialogTitle>
          <DialogDescription>
            Defina um objetivo claro e mensurável para a equipe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título do OKR</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aumentar receita em 20%"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais sobre o OKR..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="endDate">Prazo</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target">Meta (opcional)</Label>
              <Input
                id="target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                min="1"
                placeholder="Ex: 100"
              />
            </div>
            <div>
              <Label htmlFor="current">Valor Atual (opcional)</Label>
              <Input
                id="current"
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                min="0"
                placeholder="Ex: 0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createOKR.isPending}>
              {createOKR.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar OKR
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
