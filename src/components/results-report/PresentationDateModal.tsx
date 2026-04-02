import { useState } from 'react';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  clientName: string;
  taskId: string;
}

export default function PresentationDateModal({ open, onClose, clientName, taskId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (!date || !user?.id) return;

    setIsSaving(true);
    try {
      // Mark the current task as done
      await supabase
        .from('ads_tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);

      // Create the call task with the selected date as due_date
      await supabase.from('ads_tasks').insert({
        ads_manager_id: user.id,
        title: `Realizar call de "Apresentação de resultados" ${clientName}`,
        description: JSON.stringify({
          type: 'results_presentation_call',
          scheduledDate: date.toISOString(),
          sourceTaskId: taskId,
        }),
        task_type: 'daily',
        status: 'todo',
        priority: 'high',
        due_date: date.toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
      toast.success('Apresentação agendada! Tarefa de call criada.');
      setDate(undefined);
      onClose();
    } catch (error) {
      console.error('Error scheduling presentation:', error);
      toast.error('Erro ao agendar apresentação');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-primary" />
            Agendar Apresentação de Resultados
          </DialogTitle>
          <DialogDescription>
            Informe a data da apresentação para {clientName}. Uma tarefa de call será criada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-sm font-medium">
              Data da apresentação <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal mt-2',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date
                    ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            className="w-full"
            onClick={handleConfirm}
            disabled={!date || isSaving}
          >
            {isSaving ? (
              <><Loader2 size={14} className="mr-2 animate-spin" /> Agendando...</>
            ) : (
              'Confirmar e Criar Tarefa de Call'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
