import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ContractExpirationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  onConfirm: (expirationDate: Date) => void;
  isLoading?: boolean;
  title?: string;
}

export default function ContractExpirationModal({
  open,
  onOpenChange,
  clientName,
  onConfirm,
  isLoading = false,
  title = 'Contrato Assinado',
}: ContractExpirationModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(selectedDate);
      setSelectedDate(undefined);
    }
  };

  const handleClose = () => {
    setSelectedDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clientName}</span>
          </p>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Quando expira o contrato? <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'Selecione a data de expiração'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p>📅 O cliente aparecerá na coluna "Contratos próximos ao vencimento" 30 dias antes da data selecionada.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedDate || isLoading}>
            {isLoading ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
