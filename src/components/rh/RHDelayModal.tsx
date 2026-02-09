import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import { 
  RHVaga, 
  RHVagaBriefing, 
  useCreateRHJustificativa,
  useCreateRHAtividade,
  useMoveRHVaga,
  useUpdateRHVagaBriefing,
  useRHVagaBriefing as useRHVagaBriefingQuery
} from '@/hooks/useRH';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface RHDelayModalProps {
  vaga: RHVaga;
  briefing?: RHVagaBriefing;
  isOpen: boolean;
  onClose: () => void;
}

export default function RHDelayModal({ vaga, briefing, isOpen, onClose, onJustified }: RHDelayModalProps & { onJustified?: () => void }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [novaData, setNovaData] = useState('');
  
  const createJustificativa = useCreateRHJustificativa();
  const createAtividade = useCreateRHAtividade();
  const moveVaga = useMoveRHVaga();
  const updateBriefing = useUpdateRHVagaBriefing();
  const { data: currentBriefing } = useRHVagaBriefingQuery(vaga.id);

  const activeBriefing = briefing || currentBriefing;

  const daysOverdue = activeBriefing?.data_limite 
    ? differenceInDays(new Date(), new Date(activeBriefing.data_limite))
    : 0;

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      toast.error('Por favor, informe o motivo do atraso');
      return;
    }
    if (!novaData) {
      toast.error('Por favor, informe a nova data limite');
      return;
    }

    try {
      // Create justification
      await createJustificativa.mutateAsync({
        vaga_id: vaga.id,
        user_id: user?.id,
        user_name: user?.name,
        motivo: motivo.trim(),
        nova_data: novaData,
      });

      // Update briefing with new deadline
      if (activeBriefing?.id) {
        await updateBriefing.mutateAsync({
          id: activeBriefing.id,
          data_limite: novaData,
        });
      }

      // Move vaga to justificativa status
      await moveVaga.mutateAsync({
        id: vaga.id,
        status: 'justificativa',
        position: 0,
      });

      // Log activity
      await createAtividade.mutateAsync({
        vaga_id: vaga.id,
        user_id: user?.id,
        user_name: user?.name,
        action: 'justified_delay',
        details: { 
          reason: motivo.trim(),
          new_date: novaData,
          days_overdue: daysOverdue,
          previous_status: vaga.status
        },
      });

      toast.success('Justificativa enviada com sucesso');
      setMotivo('');
      setNovaData('');
      onJustified?.();
      onClose();
    } catch (error) {
      console.error('Error submitting justification:', error);
      toast.error('Erro ao enviar justificativa');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle className="w-5 h-5" />
            Justificar Atraso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vaga Info */}
          <div className="p-3 bg-danger/5 border border-danger/20 rounded-lg">
            <h4 className="font-medium">{activeBriefing?.nome_vaga || vaga.title}</h4>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {activeBriefing?.data_limite && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Prazo: {format(new Date(activeBriefing.data_limite), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
              )}
              {daysOverdue > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {daysOverdue} dias de atraso
                </Badge>
              )}
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo do Atraso *</Label>
            <Textarea
              id="motivo"
              placeholder="Descreva o motivo do atraso..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Nova Data */}
          <div className="space-y-2">
            <Label htmlFor="novaData">Nova Data Limite *</Label>
            <Input
              id="novaData"
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createJustificativa.isPending}
            variant="destructive"
          >
            {createJustificativa.isPending ? 'Enviando...' : 'Enviar Justificativa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
