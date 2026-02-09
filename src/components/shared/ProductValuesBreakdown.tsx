import { useClientProductValues } from '@/hooks/useClientProductValues';
import { DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ProductValuesBreakdownProps {
  clientId: string;
  showTotal?: boolean;
}

export default function ProductValuesBreakdown({ clientId, showTotal = true }: ProductValuesBreakdownProps) {
  const { data: productValues = [], isLoading } = useClientProductValues(clientId);

  if (isLoading) {
    return <div className="h-4 w-20 bg-muted/50 animate-pulse rounded" />;
  }

  if (productValues.length === 0) {
    return null;
  }

  const total = productValues.reduce((sum, pv) => sum + Number(pv.monthly_value), 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 cursor-help">
          <DollarSign size={10} className="text-success" />
          <span className="text-xs font-medium text-success">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          {productValues.length > 1 && (
            <span className="text-[10px] text-muted-foreground">
              ({productValues.length} produtos)
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5 text-xs">
          <p className="font-semibold border-b pb-1">Valores por Produto</p>
          {productValues.map((pv) => (
            <div key={pv.id} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{pv.product_name}</span>
              <span className="font-medium">
                R$ {Number(pv.monthly_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          {productValues.length > 1 && showTotal && (
            <div className="flex justify-between gap-4 pt-1 border-t font-semibold">
              <span>Total</span>
              <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
