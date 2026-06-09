import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAnyProductName } from '@/components/shared/ProductBadges';
import { useRevogarConcessao, type Concessao } from '@/hooks/useConcessoes';
import { Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RevogarConcessaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concessao: Concessao | null;
}

export function RevogarConcessaoDialog({ open, onOpenChange, concessao }: RevogarConcessaoDialogProps) {
  const revogar = useRevogarConcessao();

  if (!concessao) return null;

  const productName = getAnyProductName(concessao.product_slug);
  const clientName = concessao.client?.name || 'Cliente';

  const handleRevogar = async () => {
    try {
      await revogar.mutateAsync({
        concessaoId: concessao.id,
        clientId: concessao.client_id,
      });
      onOpenChange(false);
      toast.success('Concessão revogada', {
        description: `${productName} removido de ${clientName}.`,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      const message = err instanceof Error ? err.message : String(err);

      if (code === '42501') {
        toast.error('Revogação não permitida', {
          description: 'Você não pode revogar esta concessão.',
        });
      } else {
        toast.error('Não foi possível revogar', { description: message });
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" aria-hidden="true" />
            Revogar concessão?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{clientName}</span> vai perder o acesso a{' '}
            <span className="font-medium text-foreground">{productName}</span>. O card de entrega será
            arquivado e o produto removido do cliente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revogar.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleRevogar();
            }}
            disabled={revogar.isPending}
            className={cn(buttonVariants({ variant: 'destructive' }))}
          >
            {revogar.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Revogando…
              </>
            ) : (
              'Revogar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
