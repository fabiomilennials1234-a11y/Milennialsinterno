import { Button } from '@/components/ui/button';
import { BellRing } from 'lucide-react';
import { useNudgeUser } from '@/hooks/useJustificativas';

export default function CobrarButton({ notificationId }: { notificationId: string }) {
  const { mutateAsync, isPending } = useNudgeUser();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => mutateAsync({ notificationId })}
      className="gap-2"
    >
      <BellRing size={14} />
      {isPending ? 'Cobrando...' : 'Cobrar'}
    </Button>
  );
}
