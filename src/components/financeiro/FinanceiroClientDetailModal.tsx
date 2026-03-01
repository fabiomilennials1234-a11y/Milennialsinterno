import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, FileText, MapPin, DollarSign, Calendar,
  UserCheck, CheckCircle, Clock, Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

interface ClientDetail {
  id: string;
  name: string;
  razao_social: string | null;
  cnpj: string | null;
  cpf: string | null;
  niche: string | null;
  entry_date: string | null;
  assigned_ads_manager: string | null;
  contract_duration_months: number | null;
}

interface FinanceiroTaskInfo {
  id: string;
  product_slug: string;
  product_name: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface ProductValueInfo {
  product_slug: string;
  product_name: string;
  monthly_value: number;
}

interface AdsManagerInfo {
  name: string;
  email: string;
}

interface FinanceiroClientDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  productSlug: string | null;
  productName: string | null;
  contractExpiresAt: string | null;
  activeMonthlyValue: number;
}

export default function FinanceiroClientDetailModal({
  open,
  onOpenChange,
  clientId,
  productSlug,
  productName: currentProductName,
  contractExpiresAt,
  activeMonthlyValue,
}: FinanceiroClientDetailModalProps) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [tasks, setTasks] = useState<FinanceiroTaskInfo[]>([]);
  const [productValues, setProductValues] = useState<ProductValueInfo[]>([]);
  const [adsManager, setAdsManager] = useState<AdsManagerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch client details
        const { data: clientData } = await supabase
          .from('clients')
          .select('id, name, razao_social, cnpj, cpf, niche, entry_date, assigned_ads_manager, contract_duration_months')
          .eq('id', clientId)
          .single();

        if (clientData) {
          setClient(clientData as ClientDetail);

          // Fetch ads manager name
          if (clientData.assigned_ads_manager) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('user_id', clientData.assigned_ads_manager)
              .single();

            if (profileData) {
              setAdsManager(profileData as AdsManagerInfo);
            }
          }
        }

        // Fetch financeiro tasks
        const { data: tasksData } = await supabase
          .from('financeiro_tasks')
          .select('id, product_slug, product_name, status, completed_at, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true });

        setTasks((tasksData || []) as FinanceiroTaskInfo[]);

        // Fetch product values
        const { data: pvData } = await supabase
          .from('client_product_values')
          .select('product_slug, product_name, monthly_value')
          .eq('client_id', clientId);

        setProductValues((pvData || []) as ProductValueInfo[]);
      } catch (err) {
        console.error('Error fetching client detail:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [open, clientId]);

  if (!clientId) return null;

  const displayName = client?.razao_social || client?.name || 'Cliente';

  // Build product breakdown: merge productValues with task statuses
  const productBreakdown = productValues.map(pv => {
    const task = tasks.find(t => t.product_slug === pv.product_slug);
    return {
      productName: pv.product_name,
      monthlyValue: pv.monthly_value,
      taskStatus: task?.status || 'no_task',
      completedAt: task?.completed_at,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 size={20} className="text-primary" />
            Detalhes do Cliente
            {currentProductName && (
              <Badge variant="outline" className="text-xs ml-1">
                <Package size={10} className="mr-1" />
                {currentProductName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-3/4 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        ) : client ? (
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Client Name */}
            <div>
              <h3 className="text-lg font-bold text-foreground">{displayName}</h3>
              {client.razao_social && client.name !== client.razao_social && (
                <p className="text-sm text-muted-foreground">{client.name}</p>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* CNPJ */}
              {client.cnpj && (
                <Card className="border-subtle">
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">CNPJ</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{client.cnpj}</p>
                  </CardContent>
                </Card>
              )}

              {/* CPF */}
              {client.cpf && (
                <Card className="border-subtle">
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">CPF</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{client.cpf}</p>
                  </CardContent>
                </Card>
              )}

              {/* Nicho */}
              {client.niche && (
                <Card className="border-subtle">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-muted-foreground" />
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Nicho</p>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-0.5">{client.niche}</p>
                  </CardContent>
                </Card>
              )}

              {/* Gestor de Ads */}
              {adsManager && (
                <Card className="border-subtle">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1">
                      <UserCheck size={12} className="text-muted-foreground" />
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Gestor de Ads</p>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-0.5">{adsManager.name}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Valor Ativo + Dates */}
            <div className="grid grid-cols-1 gap-3">
              {/* Valor Ativo Total */}
              <Card className="border-subtle bg-emerald-50 dark:bg-emerald-950/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                      <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Valor do Produto</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(activeMonthlyValue)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                {/* Data de Entrada */}
                {client.entry_date && (
                  <Card className="border-subtle">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-muted-foreground" />
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Data de Entrada</p>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {format(parseISO(client.entry_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Data de Expiração */}
                {contractExpiresAt && (
                  <Card className="border-subtle">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1">
                        <FileText size={12} className="text-muted-foreground" />
                        <p className="text-[10px] uppercase text-muted-foreground font-medium">Expiração do Contrato</p>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {format(parseISO(contractExpiresAt), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Product Breakdown */}
            {productBreakdown.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Produtos Contratados</h4>
                </div>
                <div className="space-y-2">
                  {productBreakdown.map((product, idx) => {
                    const isDone = product.taskStatus === 'done';
                    return (
                      <Card key={idx} className={`border-subtle ${isDone ? '' : 'opacity-60'}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isDone ? (
                                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                              ) : (
                                <Clock size={14} className="text-warning shrink-0" />
                              )}
                              <span className="text-sm font-medium">{product.productName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">
                                {formatCurrency(product.monthlyValue)}
                              </span>
                              <Badge
                                variant={isDone ? 'default' : 'secondary'}
                                className={`text-[10px] ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-warning/10 text-warning-foreground border-warning/30'
                                }`}
                              >
                                {isDone ? 'Ativo' : 'Pendente'}
                              </Badge>
                            </div>
                          </div>
                          {isDone && product.completedAt && (
                            <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                              Concluído em {format(parseISO(product.completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Cliente não encontrado</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
