import { useState } from 'react';
import { Clock, AlertTriangle, ClipboardList, FileQuestion, Link2, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { usePaddockDiagnosticoStatus, useUpdatePaddockDiagnosticoLink } from '@/hooks/usePaddockDiagnosticoStatus';
import { toast } from 'sonner';

interface Props {
  clientId: string;
  clientName: string;
}

export default function PaddockDiagnosticoSection({ clientId, clientName }: Props) {
  const { daysLeft, daysSince, status, link, isLoading } = usePaddockDiagnosticoStatus(clientId);
  const updateLink = useUpdatePaddockDiagnosticoLink();
  const [linkInput, setLinkInput] = useState('');

  if (isLoading) return null;

  const handleAttachLink = async () => {
    if (!linkInput.trim()) return;
    try {
      await updateLink.mutateAsync({ clientId, link: linkInput.trim() });
      toast.success('Diagnóstico anexado! Ciclo de 30 dias reiniciado.');
      setLinkInput('');
    } catch {
      toast.error('Erro ao anexar diagnóstico');
    }
  };

  const statusBadge = () => {
    if (status === 'pending') {
      return (
        <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-muted-foreground/30 text-muted-foreground">
          <FileQuestion size={12} />
          Diagnóstico comercial pendente
        </Badge>
      );
    }
    if (status === 'overdue') {
      return (
        <Badge variant="destructive" className="text-xs px-2.5 py-1 gap-1.5">
          <AlertTriangle size={12} />
          Diagnóstico vencido (+{daysSince - 30}d)
        </Badge>
      );
    }
    if (status === 'alert') {
      return (
        <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-warning text-warning">
          <Clock size={12} />
          Diagnóstico comercial em {daysLeft}d
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-muted-foreground/30 text-muted-foreground">
        <ClipboardList size={12} />
        Diagnóstico comercial em {daysLeft}d
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList size={16} />
            Diagnóstico Comercial (30 dias)
          </h3>
          {statusBadge()}
        </div>

        {/* Link atual */}
        {link && (
          <div className="p-2.5 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Link do diagnóstico atual</p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline break-all flex items-center gap-1.5 hover:text-primary/80"
            >
              <ExternalLink size={12} className="shrink-0" />
              {link}
            </a>
          </div>
        )}

        {/* Campo para anexar/atualizar link */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {link ? 'Atualizar diagnóstico (reinicia o ciclo de 30 dias):' : 'Anexar link do diagnóstico comercial:'}
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cole o link do diagnóstico aqui..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAttachLink(); }}
                className="pl-8 text-xs"
              />
            </div>
            <Button
              onClick={handleAttachLink}
              disabled={!linkInput.trim() || updateLink.isPending}
              size="sm"
              className="gap-1.5 shrink-0"
            >
              {updateLink.isPending ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              {link ? 'Atualizar' : 'Anexar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
