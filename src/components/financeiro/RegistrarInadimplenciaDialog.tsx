import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  productSlug: string;
  productName: string;
  monthlyValue: number;
  activeRecordId: string;
}

const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = -2; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    });
  }
  return options;
};

export default function RegistrarInadimplenciaDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  productSlug,
  productName,
  monthlyValue,
  activeRecordId,
}: Props) {
  const queryClient = useQueryClient();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [faturasCount, setFaturasCount] = useState('1');
  const [valor, setValor] = useState(String(monthlyValue));
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const handleSubmit = async () => {
    const numFaturas = parseInt(faturasCount);
    const numValor = parseFloat(valor.replace(/[^\d.,]/g, '').replace(',', '.'));

    if (isNaN(numFaturas) || numFaturas < 1) {
      toast.error('Informe a quantidade de faturas em atraso');
      return;
    }
    if (isNaN(numValor) || numValor < 0) {
      toast.error('Informe um valor válido');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if entry already exists for this month + product
      const { data: existing } = await supabase
        .from('financeiro_contas_receber')
        .select('id, inadimplencia_count')
        .eq('client_id', clientId)
        .eq('produto_slug', productSlug)
        .eq('mes_referencia', selectedMonth)
        .maybeSingle();

      if (existing) {
        // Update existing entry to inadimplente
        await supabase
          .from('financeiro_contas_receber')
          .update({
            status: 'inadimplente',
            inadimplencia_count: numFaturas,
            valor: numValor,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Create new entry
        await supabase
          .from('financeiro_contas_receber')
          .insert({
            client_id: clientId,
            produto_slug: productSlug,
            valor: numValor,
            status: 'inadimplente',
            mes_referencia: selectedMonth,
            is_recurring: true,
            inadimplencia_count: numFaturas,
          });
      }

      // Also update financeiro_active_clients to reflect overdue status
      await supabase
        .from('financeiro_active_clients')
        .update({ invoice_status: 'atrasada' })
        .eq('id', activeRecordId);

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-dashboard'] });

      toast.success(`Inadimplência registrada para ${format(new Date(selectedMonth + '-15'), "MMMM/yyyy", { locale: ptBR })}`);
      onOpenChange(false);

      // Reset form
      setSelectedMonth(currentMonth);
      setFaturasCount('1');
      setValor(String(monthlyValue));
      setObservacao('');
    } catch (error) {
      console.error('Error registering inadimplencia:', error);
      toast.error('Erro ao registrar inadimplência');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            Registrar Inadimplência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client info */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-sm font-medium">{clientName}</p>
            <p className="text-xs text-primary">{productName}</p>
          </div>

          {/* Mês da inadimplência */}
          <div className="space-y-1.5">
            <Label className="text-sm">Mês da inadimplência *</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade de faturas */}
          <div className="space-y-1.5">
            <Label className="text-sm">Faturas em atraso *</Label>
            <Input
              type="number"
              min="1"
              value={faturasCount}
              onChange={(e) => setFaturasCount(e.target.value)}
              placeholder="1"
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label className="text-sm">Valor inadimplente (R$)</Label>
            <Input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <Label className="text-sm">Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes sobre a inadimplência..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrar Inadimplência'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
