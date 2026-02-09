import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  Users, 
  TrendingUp, 
  TrendingDown,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientWithProductMargin } from '@/hooks/useClientsByProduct';

interface ProductClientMarginListProps {
  productName: string;
  productColor?: string;
  clients: ClientWithProductMargin[];
  totalReceita: number;
  totalCustos: number;
  totalMargem: number;
  margemPercent: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function ProductClientMarginList({
  productName,
  productColor = '#6366f1',
  clients,
  totalReceita,
  totalCustos,
  totalMargem,
  margemPercent,
}: ProductClientMarginListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isPositive = (value: number) => value >= 0;

  return (
    <Card className="border-subtle">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: productColor }} 
                />
                <CardTitle className="text-sm font-semibold">{productName}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  <Users size={10} className="mr-1" />
                  {clients.length} clientes
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-bold",
                    isPositive(totalMargem) ? "text-emerald-600" : "text-destructive"
                  )}>
                    {formatCurrency(totalMargem)}
                  </span>
                  <Badge 
                    className={cn(
                      "text-xs",
                      isPositive(margemPercent) 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50" 
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {margemPercent.toFixed(1)}%
                  </Badge>
                </div>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-2 pb-4">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-muted/50 rounded-lg text-xs">
              <div className="text-center">
                <span className="text-muted-foreground">Receita</span>
                <p className="font-semibold text-emerald-600">{formatCurrency(totalReceita)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground">Custos</span>
                <p className="font-semibold text-orange-600">{formatCurrency(totalCustos)}</p>
              </div>
              <div className="text-center">
                <span className="text-muted-foreground">Margem</span>
                <p className={cn(
                  "font-semibold",
                  isPositive(totalMargem) ? "text-emerald-600" : "text-destructive"
                )}>
                  {formatCurrency(totalMargem)}
                </p>
              </div>
            </div>

            {/* Client list */}
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {clients.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum cliente com valor cadastrado
                  </p>
                ) : (
                  clients.map((client) => (
                    <div 
                      key={client.clientId}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                          isPositive(client.margin) ? "bg-emerald-100" : "bg-destructive/10"
                        )}>
                          {isPositive(client.margin) ? (
                            <TrendingUp size={12} className="text-emerald-600" />
                          ) : (
                            <TrendingDown size={12} className="text-destructive" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {client.clientName}
                          </p>
                          {client.razaoSocial && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {client.razaoSocial}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Receita</p>
                          <p className="text-xs font-medium text-emerald-600">
                            {formatCurrency(client.monthlyValue)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Custo Est.</p>
                          <p className="text-xs font-medium text-orange-600">
                            {formatCurrency(client.estimatedCost)}
                          </p>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <p className="text-[10px] text-muted-foreground">Margem</p>
                          <div className="flex items-center gap-1 justify-end">
                            <span className={cn(
                              "text-xs font-bold",
                              isPositive(client.margin) ? "text-emerald-600" : "text-destructive"
                            )}>
                              {formatCurrency(client.margin)}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-[10px] px-1 py-0",
                                isPositive(client.marginPercent) 
                                  ? "bg-emerald-100 text-emerald-700" 
                                  : "bg-destructive/10 text-destructive"
                              )}
                            >
                              {client.marginPercent.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
