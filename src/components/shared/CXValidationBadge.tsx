import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCXValidationStatus } from '@/hooks/useCXValidation';

interface Props {
  clientId: string;
  className?: string;
}

export default function CXValidationBadge({ clientId, className }: Props) {
  const { isAwaitingValidation } = useCXValidationStatus();

  if (!isAwaitingValidation(clientId)) return null;

  return (
    <Badge
      variant="destructive"
      className={`text-[10px] px-1.5 py-0.5 gap-1 animate-pulse font-bold uppercase ${className || ''}`}
    >
      <ShieldAlert size={10} />
      Esperar Validação
    </Badge>
  );
}
