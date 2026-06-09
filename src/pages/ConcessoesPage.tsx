import { useMemo, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HandHeart,
  RotateCcw,
  Ban,
  AlertTriangle,
  MoreHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { classifyExpiry, countExpiringSoon } from '@/lib/concessaoExpiry';
import { useConcessoes, type Concessao, type ConcessaoMotivo, type ConcessaoStatus } from '@/hooks/useConcessoes';
import { getAnyProductName } from '@/components/shared/ProductBadges';
import { RevogarConcessaoDialog } from '@/components/concessao/RevogarConcessaoDialog';
import { ConverterConcessaoModal } from '@/components/concessao/ConverterConcessaoModal';

const MOTIVO_LABEL: Record<ConcessaoMotivo, string> = {
  risco_churn: 'Risco de churn',
  compensacao_falha: 'Compensação por falha',
  negociacao_renovacao: 'Negociação de renovação',
  cortesia_estrategica: 'Cortesia estratégica',
};

const STATUS_LABEL: Record<ConcessaoStatus, string> = {
  ativa: 'Ativa',
  convertida: 'Convertida',
  revogada: 'Revogada',
};

function StatusBadge({ status }: { status: ConcessaoStatus }) {
  if (status === 'ativa') {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-500">
        <HandHeart className="h-3 w-3 mr-1" aria-hidden="true" />
        Ativa
      </Badge>
    );
  }
  if (status === 'convertida') {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-500">
        <RotateCcw className="h-3 w-3 mr-1" aria-hidden="true" />
        Convertida
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
      <Ban className="h-3 w-3 mr-1" aria-hidden="true" />
      Revogada
    </Badge>
  );
}

// Expiração: >7d → "Revisar dd/MM" muted; ≤7d → danger + ícone; vencida → danger.
// Só para concessões ativas (convertida/revogada não têm revisão pendente).
function ExpiryHint({ concessao }: { concessao: Concessao }) {
  if (concessao.status !== 'ativa' || !concessao.contract_expires_at) return null;

  const expires = new Date(concessao.contract_expires_at);
  const state = classifyExpiry(concessao.contract_expires_at);

  if (state === 'overdue') {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Revisão vencida
      </span>
    );
  }
  if (state === 'due_soon') {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Revisar {format(expires, 'dd/MM', { locale: ptBR })}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      Revisar {format(expires, 'dd/MM', { locale: ptBR })}
    </span>
  );
}

export default function ConcessoesPage() {
  const { data: concessoes = [], isLoading } = useConcessoes();
  const [statusFilter, setStatusFilter] = useState<ConcessaoStatus | 'all'>('all');
  const [motivoFilter, setMotivoFilter] = useState<ConcessaoMotivo | 'all'>('all');
  const [revogarTarget, setRevogarTarget] = useState<Concessao | null>(null);
  const [converterTarget, setConverterTarget] = useState<Concessao | null>(null);

  const filtered = useMemo(() => {
    return concessoes.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (motivoFilter !== 'all' && c.motivo !== motivoFilter) return false;
      return true;
    });
  }, [concessoes, statusFilter, motivoFilter]);

  // Contagem de governança (sobre o conjunto TOTAL, não filtrado — é a foto da margem).
  const counts = useMemo(() => {
    const ativas = concessoes.filter((c) => c.status === 'ativa').length;
    const convertidas = concessoes.filter((c) => c.status === 'convertida').length;
    const revogadas = concessoes.filter((c) => c.status === 'revogada').length;
    const expirando = countExpiringSoon(concessoes);
    return { ativas, convertidas, revogadas, expirando };
  }, [concessoes]);

  const hasFilters = statusFilter !== 'all' || motivoFilter !== 'all';
  const clearFilters = () => {
    setStatusFilter('all');
    setMotivoFilter('all');
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HandHeart className="h-6 w-6 text-amber-600 dark:text-amber-500" aria-hidden="true" />
              Concessões
            </h1>
            <p className="text-muted-foreground">
              Produtos concedidos sem custo para retenção. Governança de margem — não é receita.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ConcessaoStatus | 'all')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="convertida">Convertida</SelectItem>
                <SelectItem value="revogada">Revogada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={motivoFilter} onValueChange={(v) => setMotivoFilter(v as ConcessaoMotivo | 'all')}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os motivos</SelectItem>
                {(Object.keys(MOTIVO_LABEL) as ConcessaoMotivo[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOTIVO_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Barra de contagem de governança */}
        {!isLoading && concessoes.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>{counts.ativas} ativas</span>
            <span aria-hidden="true">·</span>
            <span>{counts.convertidas} convertidas</span>
            <span aria-hidden="true">·</span>
            <span>{counts.revogadas} revogadas</span>
            {counts.expirando > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                {counts.expirando} expirando em 7 dias
              </Badge>
            )}
          </div>
        )}

        {/* Lista / Estados */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-lg border bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : concessoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <HandHeart className="h-10 w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <p className="font-medium">Nenhuma concessão registrada</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Quando um cliente em risco recebe um produto de cortesia, ele aparece aqui. Conceda pelo
              card do cliente.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <p className="font-medium">Nenhuma concessão com esses filtros</p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const isRevogada = c.status === 'revogada';
              const isRiscoChurn = c.motivo === 'risco_churn';
              return (
                <div
                  key={c.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between',
                    isRevogada && 'opacity-60'
                  )}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                      <HandHeart className="h-5 w-5 text-amber-600 dark:text-amber-500" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.client?.name || 'Cliente'}</span>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-500">
                          {getAnyProductName(c.product_slug)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn('border-border', isRiscoChurn && 'text-destructive border-destructive/30')}
                        >
                          {MOTIVO_LABEL[c.motivo]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Concedido {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })} · por{' '}
                        {c.granted_by_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <ExpiryHint concessao={c} />
                    <StatusBadge status={c.status} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações da concessão">
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Só concessões ativas têm transição: convertida/revogada são terminais. */}
                        <DropdownMenuItem
                          disabled={c.status !== 'ativa'}
                          onClick={() => setConverterTarget(c)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                          Converter em pago
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={c.status !== 'ativa'}
                          onClick={() => setRevogarTarget(c)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Ban className="h-4 w-4 mr-2" aria-hidden="true" />
                          Revogar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RevogarConcessaoDialog
        open={!!revogarTarget}
        onOpenChange={(open) => !open && setRevogarTarget(null)}
        concessao={revogarTarget}
      />
      <ConverterConcessaoModal
        open={!!converterTarget}
        onOpenChange={(open) => !open && setConverterTarget(null)}
        concessao={converterTarget}
      />
    </MainLayout>
  );
}
