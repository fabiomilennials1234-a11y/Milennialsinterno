import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateNPSSurvey } from '@/hooks/useNPSSurveys';
import { BarChart3, Loader2 } from 'lucide-react';

interface NPSCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NPSCreateModal({ open, onOpenChange }: NPSCreateModalProps) {
  const [title, setTitle] = useState('Pesquisa NPS | Millennials');
  const [description, setDescription] = useState('');
  
  const createSurvey = useCreateNPSSurvey();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createSurvey.mutateAsync({ title, description: description || undefined });
      onOpenChange(false);
      setTitle('Pesquisa NPS | Millennials');
      setDescription('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <BarChart3 className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <DialogTitle>Nova Pesquisa NPS</DialogTitle>
              <DialogDescription>
                Crie uma nova pesquisa de satisfação para enviar aos clientes
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título da Pesquisa</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pesquisa NPS | Millennials"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição ou notas internas sobre esta pesquisa..."
              rows={3}
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">Perguntas incluídas:</p>
            <ul className="text-muted-foreground text-xs space-y-1 list-disc list-inside">
              <li>Nome da empresa</li>
              <li>Nota NPS (0-10)</li>
              <li>Motivo da nota</li>
              <li>Alinhamento de estratégias</li>
              <li>Avaliação de comunicação</li>
              <li>Avaliação de criativos</li>
              <li>Representação da marca</li>
              <li>Sugestões de melhoria</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createSurvey.isPending || !title.trim()}
            >
              {createSurvey.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Criar Pesquisa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
