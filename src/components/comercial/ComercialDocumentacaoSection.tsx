import { useState } from 'react';
import { FileText, Calendar, Eye, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Helper to get date in Brazil timezone
function getDateKeyInBrazilTZ(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

interface DocWithClient {
  id: string;
  comercial_user_id: string;
  client_id: string;
  documentation_date: string;
  helped_client: boolean;
  help_description: string;
  has_combinado: boolean;
  combinado_description?: string;
  combinado_deadline?: string;
  created_at: string;
  client?: {
    id: string;
    name: string;
  };
}

function useComercialDocsToday() {
  const { user } = useAuth();
  const today = getDateKeyInBrazilTZ();

  return useQuery({
    queryKey: ['comercial-docs-today', user?.id, today],
    queryFn: async (): Promise<DocWithClient[]> => {
      const { data, error } = await supabase
        .from('comercial_client_documentation')
        .select('*, client:clients(id, name)')
        .eq('comercial_user_id', user?.id)
        .eq('documentation_date', today)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DocWithClient[];
    },
    enabled: !!user,
  });
}

function DocCard({ doc }: { doc: DocWithClient }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        className="p-3 rounded-lg border bg-card border-subtle cursor-pointer transition-all hover:shadow-md"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {doc.helped_client ? (
              <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
            ) : (
              <XCircle size={14} className="text-destructive flex-shrink-0" />
            )}
            <span className="text-sm font-medium truncate">
              {doc.client?.name || 'Cliente'}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {doc.has_combinado && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary text-primary">
                <MessageSquare size={8} className="mr-0.5" />
                Combinado
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Eye size={12} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {doc.help_description}
        </p>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={18} />
              {doc.client?.name || 'Cliente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Status de ajuda */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                {doc.helped_client ? (
                  <>
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Cliente foi ajudado hoje
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-destructive" />
                    <span className="text-sm font-medium text-destructive">
                      Cliente não foi ajudado hoje
                    </span>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {doc.help_description}
              </p>
            </div>

            {/* Combinado */}
            {doc.has_combinado && doc.combinado_description && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={16} className="text-primary" />
                  <span className="text-sm font-medium">Combinado</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {doc.combinado_description}
                </p>
                {doc.combinado_deadline && (
                  <p className="text-xs text-primary mt-2 flex items-center gap-1">
                    <Calendar size={12} />
                    Prazo: {format(new Date(doc.combinado_deadline), "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            )}

            {/* Hora do registro */}
            <p className="text-xs text-muted-foreground text-right">
              Registrado às {format(new Date(doc.created_at), "HH:mm")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ComercialDocumentacaoSection() {
  const { data: docs = [], isLoading } = useComercialDocsToday();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
        <p className="text-xs text-primary font-medium">
          📋 A documentação é criada automaticamente ao movimentar clientes no Acompanhamento
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-green-500/10 rounded-lg text-center">
          <p className="text-lg font-bold text-green-500">
            {docs.filter(d => d.helped_client).length}
          </p>
          <p className="text-[10px] text-muted-foreground">Ajudados</p>
        </div>
        <div className="p-2 bg-destructive/10 rounded-lg text-center">
          <p className="text-lg font-bold text-destructive">
            {docs.filter(d => !d.helped_client).length}
          </p>
          <p className="text-[10px] text-muted-foreground">Não ajudados</p>
        </div>
      </div>

      {/* Lista de documentações */}
      {docs.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <FileText className="mx-auto mb-2 opacity-50" size={28} />
          <p className="text-sm">Nenhuma documentação hoje</p>
          <p className="text-xs mt-1">Movimente clientes para criar</p>
        </div>
      ) : (
        docs.map((doc) => <DocCard key={doc.id} doc={doc} />)
      )}
    </div>
  );
}
