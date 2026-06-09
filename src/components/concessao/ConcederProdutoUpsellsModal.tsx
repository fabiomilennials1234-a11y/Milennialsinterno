import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCT_CONFIG, UPSELL_ONLY_PRODUCT_CONFIG } from '@/components/shared/ProductBadges';
import { useClientsWithSales } from '@/hooks/useClientList';
import { useConcederProduto, type ConcessaoMotivo } from '@/hooks/useConcessoes';
import { HandHeart, CalendarClock, Loader2, AlertTriangle, User } from 'lucide-react';
import { toast } from 'sonner';

interface ConcederProdutoUpsellsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MOTIVO_OPTIONS: { value: ConcessaoMotivo; label: string }[] = [
  { value: 'risco_churn', label: 'Risco de churn' },
  { value: 'compensacao_falha', label: 'Compensação por falha' },
  { value: 'negociacao_renovacao', label: 'Negociação de renovação' },
  { value: 'cortesia_estrategica', label: 'Cortesia estratégica' },
];

/**
 * Variante standalone do ConcederProdutoModal para a página /upsells.
 *
 * Diferença estrutural do ConcederProdutoModal (prop-driven, lançado do Card
 * Universal): aqui não há contexto de cliente. O cliente é o PRIMEIRO campo —
 * tudo abaixo (produto) deriva da escolha dele. Espelha o select de cliente do
 * CreateUpsellModal (ícone User, label "Cliente"), mas mantém integralmente a
 * paleta/copy/intenção do fluxo de Concessão (âmbar, HandHeart, sem receita).
 *
 * Gating de QUEM pode conceder é re-checado server-side na RPC conceder_produto.
 */
export function ConcederProdutoUpsellsModal({ open, onOpenChange }: ConcederProdutoUpsellsModalProps) {
  const [clientId, setClientId] = useState('');
  const [productSlug, setProductSlug] = useState('');
  const [motivo, setMotivo] = useState<ConcessaoMotivo | ''>('');
  const [reviewDate, setReviewDate] = useState('');

  const { data: clients = [], isLoading: isLoadingClients } = useClientsWithSales();
  const concederProduto = useConcederProduto();

  // Mesma regra do CreateUpsellModal: só clientes ativos.
  const activeClients = clients.filter((c) => !c.archived && c.status !== 'churned');

  const selectedClient = activeClients.find((c) => c.id === clientId);
  const clientName = selectedClient?.name ?? '';
  const clientProducts = selectedClient?.contracted_products || [];
  const clientTorqueSubs =
    (selectedClient as { torque_crm_products?: string[] } | undefined)?.torque_crm_products || [];

  // Catálogo principal + sub-produtos Torque CRM, removendo o que o cliente já
  // tem. Mesma lógica do CreateUpsellModal/ConcederProdutoModal — torque-crm-<sub>
  // mapeia para o tier <sub>.
  const catalogProducts = Object.entries(PRODUCT_CONFIG).filter(
    ([slug]) => !clientProducts.includes(slug)
  );
  const torqueSubProducts = Object.entries(UPSELL_ONLY_PRODUCT_CONFIG).filter(([slug]) => {
    const sub = slug.replace('torque-crm-', '');
    return !clientTorqueSubs.includes(sub);
  });
  const availableProducts = [...catalogProducts, ...torqueSubProducts];

  const resetForm = () => {
    setClientId('');
    setProductSlug('');
    setMotivo('');
    setReviewDate('');
  };

  const handleClose = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  // Trocar de cliente invalida o produto escolhido (catálogo disponível muda).
  const handleClientChange = (next: string) => {
    setClientId(next);
    setProductSlug('');
  };

  const handleSubmit = async () => {
    if (!clientId || !productSlug || !motivo) return;

    const productName =
      PRODUCT_CONFIG[productSlug]?.name ||
      UPSELL_ONLY_PRODUCT_CONFIG[productSlug]?.name ||
      productSlug;

    try {
      await concederProduto.mutateAsync({
        clientId,
        productSlug,
        motivo,
        // Input date → timestamptz. Vazio = sem prazo (NULL).
        contractExpiresAt: reviewDate ? new Date(reviewDate).toISOString() : null,
      });

      toast.success('Produto concedido', {
        description: `${productName} concedido a ${clientName} sem custo. Aparece em Concessões.`,
      });
      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      const message = err instanceof Error ? err.message : String(err);

      if (code === '42501') {
        toast.error('Concessão não permitida', {
          description: 'Você não pode conceder produtos a este cliente.',
        });
      } else if (code === 'P0001') {
        toast.error('Produto já ativo', {
          description: `Este cliente já possui ${productName}. Não é possível conceder de novo.`,
        });
      } else {
        toast.error('Não foi possível conceder', { description: message });
      }
    }
  };

  const noProductsAvailable = !!clientId && availableProducts.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeart className="h-5 w-5 text-amber-600 dark:text-amber-500" aria-hidden="true" />
            Conceder produto
          </DialogTitle>
          <DialogDescription>
            Anexa um produto a um cliente sem custo, como alavanca de retenção. Registramos o motivo
            para auditoria — nada de receita ou comissão é gerado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Banner de intenção */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
              aria-hidden="true"
            />
            <p className="text-xs text-muted-foreground">
              Concessão é margem que a empresa abre mão para segurar o cliente. Use com intenção.
            </p>
          </div>

          {/* Cliente — primeiro campo. Tudo abaixo deriva daqui. */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" aria-hidden="true" />
              Cliente
            </Label>
            <Select value={clientId} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingClients ? (
                  <SelectItem value="loading" disabled>
                    Carregando…
                  </SelectItem>
                ) : activeClients.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum cliente ativo
                  </SelectItem>
                ) : (
                  activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Produto — disabled até cliente escolhido. */}
          <div className="space-y-2">
            <Label>Produto</Label>
            <Select value={productSlug} onValueChange={setProductSlug} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={clientId ? 'Selecione o produto a conceder' : 'Selecione um cliente primeiro'}
                />
              </SelectTrigger>
              <SelectContent>
                {noProductsAvailable ? (
                  <SelectItem value="none" disabled>
                    Este cliente já possui todos os produtos
                  </SelectItem>
                ) : (
                  availableProducts.map(([slug, config]) => (
                    <SelectItem key={slug} value={slug}>
                      {config.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {noProductsAvailable && (
              <p className="text-xs text-muted-foreground">
                Este cliente já possui todos os produtos. Não há nada a conceder.
              </p>
            )}
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as ConcessaoMotivo)} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder="Por que estamos concedendo?" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data de revisão (opcional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Data de revisão
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              disabled={!clientId}
            />
            <p className="text-xs text-muted-foreground">
              Força revisitar se ainda vale conceder. Deixe em branco para concessão sem prazo.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!clientId || !productSlug || !motivo || concederProduto.isPending}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {concederProduto.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Concedendo…
              </>
            ) : (
              'Conceder produto'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
