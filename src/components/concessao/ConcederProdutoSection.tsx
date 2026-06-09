import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HandHeart } from 'lucide-react';
import { ConcederProdutoModal } from './ConcederProdutoModal';

interface Props {
  clientId: string;
  clientName: string;
  contractedProducts: string[];
  torqueCrmProducts?: string[];
}

/**
 * Seção "Conceder produto" do Card Universal do cliente (ClientViewModal).
 * Onde a decisão de retenção nasce (ADR 0009 §5). O gating de QUEM pode
 * conceder é re-checado server-side na RPC conceder_produto (_concessao_pode_conceder);
 * a renderização condicional aqui é só UX — quem não deve ver, não vê o botão.
 */
export function ConcederProdutoSection({
  clientId,
  clientName,
  contractedProducts,
  torqueCrmProducts,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="bg-muted/20 rounded-xl p-4 border border-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HandHeart className="w-4 h-4 text-amber-600 dark:text-amber-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Conceder produto</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Anexa um produto a este cliente sem custo, como alavanca de retenção. Não gera receita
            nem comissão.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModalOpen(true)}
          className="w-full sm:w-auto gap-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-500"
        >
          <HandHeart size={14} aria-hidden="true" />
          Conceder
        </Button>
      </div>

      <ConcederProdutoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        clientId={clientId}
        clientName={clientName}
        contractedProducts={contractedProducts}
        torqueCrmProducts={torqueCrmProducts}
      />
    </div>
  );
}
