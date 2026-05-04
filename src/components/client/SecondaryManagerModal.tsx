import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAdsManagers } from '@/hooks/useClientRegistration';
import {
  useSecondaryManager,
  useSetSecondaryManager,
  useRemoveSecondaryManager,
} from '@/hooks/useSecondaryManager';
import { cn } from '@/lib/utils';
import { Users, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  primaryManagerId: string | null;
  primaryManagerName: string;
}

export default function SecondaryManagerModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  primaryManagerId,
  primaryManagerName,
}: Props) {
  const { data: existing, isLoading: loadingExisting } = useSecondaryManager(open ? clientId : undefined);
  const { data: allManagers = [] } = useAdsManagers();
  const setSecondary = useSetSecondaryManager();
  const removeSecondary = useRemoveSecondaryManager();

  const [phase, setPhase] = useState<'onboarding' | 'acompanhamento'>('onboarding');
  const [selectedManagerId, setSelectedManagerId] = useState('');

  useEffect(() => {
    if (existing) {
      setPhase(existing.phase);
      setSelectedManagerId(existing.secondary_manager_id);
    } else {
      setPhase('onboarding');
      setSelectedManagerId('');
    }
  }, [existing, open]);

  const availableManagers = allManagers.filter(m => m.user_id !== primaryManagerId);

  const handleSave = async () => {
    if (!selectedManagerId) return;
    await setSecondary.mutateAsync({
      clientId,
      secondaryManagerId: selectedManagerId,
      phase,
    });
    onOpenChange(false);
  };

  const handleRemove = async () => {
    await removeSecondary.mutateAsync(clientId);
    onOpenChange(false);
  };

  const isEditing = !!existing;
  const isSaving = setSecondary.isPending || removeSecondary.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestor Secundário
          </DialogTitle>
          <DialogDescription>
            {clientName} · Gestor principal: {primaryManagerName}
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fase do cliente
              </label>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPhase('onboarding')}
                  className={cn(
                    'flex-1 rounded-lg border p-3 text-center transition-colors',
                    phase === 'onboarding'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30',
                  )}
                >
                  <div className="text-sm font-semibold">Onboarding</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Recebe tarefas</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('acompanhamento')}
                  className={cn(
                    'flex-1 rounded-lg border p-3 text-center transition-colors',
                    phase === 'acompanhamento'
                      ? 'border-success bg-success/10 text-success'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30',
                  )}
                >
                  <div className="text-sm font-semibold">Acompanhamento</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Só visualiza</div>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Gestor secundário
              </label>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full mt-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Selecionar gestor...</option>
                {availableManagers.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={!selectedManagerId || isSaving}
                className="flex-1"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              {isEditing && (
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={isSaving}
                >
                  Remover
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
