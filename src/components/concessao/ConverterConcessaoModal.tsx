import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getAnyProductName } from '@/components/shared/ProductBadges';
import { useConverterConcessao, type Concessao } from '@/hooks/useConcessoes';
import { commissionPreview, isMonthlyValueInvalid, canSubmitConversion } from '@/lib/concessaoConverter';
import { cn } from '@/lib/utils';
import { RotateCcw, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConverterConcessaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concessao: Concessao | null;
}

interface CSUser {
  user_id: string;
  name: string;
}

export function ConverterConcessaoModal({ open, onOpenChange, concessao }: ConverterConcessaoModalProps) {
  const [monthlyValue, setMonthlyValue] = useState('');
  const [csUserId, setCsUserId] = useState('');
  const [csUsers, setCsUsers] = useState<CSUser[]>([]);
  const [isLoadingCS, setIsLoadingCS] = useState(false);

  const converter = useConverterConcessao();

  // Carrega CS (mesma query do CreateUpsellModal): user_roles → profiles.
  useEffect(() => {
    async function loadCSUsers() {
      setIsLoadingCS(true);
      try {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'sucesso_cliente');

        if (roles && roles.length > 0) {
          const userIds = roles.map((r) => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', userIds);

          setCsUsers(profiles || []);
        } else {
          setCsUsers([]);
        }
      } catch (error) {
        console.error('Error loading CS users:', error);
      } finally {
        setIsLoadingCS(false);
      }
    }

    if (open) {
      loadCSUsers();
    }
  }, [open]);

  // Default: quem concedeu, se estiver entre os CS carregados.
  useEffect(() => {
    if (!open || !concessao) return;
    if (csUsers.some((u) => u.user_id === concessao.granted_by)) {
      setCsUserId(concessao.granted_by);
    }
  }, [open, concessao, csUsers]);

  if (!concessao) return null;

  const productName = getAnyProductName(concessao.product_slug);
  const clientName = concessao.client?.name || 'Cliente';

  const value = Number(monthlyValue);
  const valueInvalid = isMonthlyValueInvalid(monthlyValue);
  const commission = commissionPreview(value);
  const canSubmit = canSubmitConversion(monthlyValue, csUserId);

  const reset = () => {
    setMonthlyValue('');
    setCsUserId('');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await converter.mutateAsync({
        concessaoId: concessao.id,
        clientId: concessao.client_id,
        monthlyValue: value,
        csUserId,
      });
      reset();
      onOpenChange(false);
      toast.success('Concessão convertida', {
        description: `${clientName} agora paga ${productName}.`,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      const message = err instanceof Error ? err.message : String(err);

      if (code === '42501') {
        toast.error('Conversão não permitida', {
          description: 'Você não pode converter esta concessão.',
        });
      } else {
        toast.error('Não foi possível converter', { description: message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-emerald-600 dark:text-emerald-500" aria-hidden="true" />
            Converter em pago
          </DialogTitle>
          <DialogDescription>
            Converter encerra a cortesia: <span className="font-medium text-foreground">{clientName}</span>{' '}
            passa a pagar <span className="font-medium text-foreground">{productName}</span>. Gera comissão e
            entra no MRR. O produto já entregue não é recriado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Valor mensal */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" aria-hidden="true" />
              Valor mensal acordado (R$)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={monthlyValue}
              onChange={(e) => setMonthlyValue(e.target.value)}
              placeholder="0,00"
              aria-invalid={valueInvalid}
              className={cn(valueInvalid && 'border-destructive focus-visible:ring-destructive')}
            />
            {valueInvalid && (
              <p className="text-xs text-destructive">Informe um valor maior que zero.</p>
            )}
          </div>

          {/* CS que recebe a comissão */}
          <div className="space-y-2">
            <Label>CS que recebe a comissão</Label>
            <Select value={csUserId} onValueChange={setCsUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o CS" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingCS ? (
                  <SelectItem value="loading" disabled>
                    Carregando…
                  </SelectItem>
                ) : csUsers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum CS encontrado
                  </SelectItem>
                ) : (
                  csUsers.map((cs) => (
                    <SelectItem key={cs.user_id} value={cs.user_id}>
                      {cs.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Preview de comissão */}
          {value > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-sm text-muted-foreground">Comissão automática (7%):</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-500">
                R$ {commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={converter.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || converter.isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {converter.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Convertendo…
              </>
            ) : (
              'Converter em pago'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
