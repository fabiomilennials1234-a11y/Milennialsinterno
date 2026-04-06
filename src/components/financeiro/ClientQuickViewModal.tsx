import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ClientInfo {
  name: string;
  razao_social: string | null;
  cnpj: string | null;
  cpf: string | null;
  phone: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
}

export default function ClientQuickViewModal({ open, onOpenChange, clientId }: Props) {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;

    const fetch = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('clients')
          .select('name, razao_social, cnpj, cpf, phone')
          .eq('id', clientId)
          .single();

        setClient(data as ClientInfo | null);
      } catch {
        setClient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [open, clientId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 size={18} className="text-primary" />
            Dados do Cliente
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : client ? (
          <div className="space-y-3 py-1">
            {/* Nome */}
            <div className="grid grid-cols-2 gap-3">
              {/* Nome Fantasia */}
              <Card className="border-subtle">
                <CardContent className="p-3">
                  <p className="text-[10px] uppercase text-muted-foreground font-medium">Nome Fantasia</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{client.name}</p>
                </CardContent>
              </Card>

              {/* Razão Social */}
              {client.razao_social && (
                <Card className="border-subtle">
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Razão Social</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{client.razao_social}</p>
                  </CardContent>
                </Card>
              )}
            </div>

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
            </div>

            {/* Telefone */}
            {client.phone && (
              <Card className="border-subtle">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1">
                    <Phone size={12} className="text-muted-foreground" />
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Telefone</p>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-0.5">{client.phone}</p>
                </CardContent>
              </Card>
            )}

            {/* Empty state for missing data */}
            {!client.cnpj && !client.cpf && !client.phone && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum dado adicional cadastrado
              </p>
            )}
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Cliente não encontrado</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
