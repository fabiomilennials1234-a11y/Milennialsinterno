import { useState } from 'react';
import { useBoard } from '@/hooks/useKanban';
import { Loader2, Users, UserCheck, Eye } from 'lucide-react';
import ClientRegistrationForm from '@/components/client-registration/ClientRegistrationForm';
import ClientViewModal from '@/components/client/ClientViewModal';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientRegistrationBoardProps {
  boardSlug: string;
}

interface RecentClient {
  id: string;
  name: string;
  razao_social: string | null;
  created_at: string;
  status: string | null;
}

export default function ClientRegistrationBoard({ boardSlug }: ClientRegistrationBoardProps) {
  const { data: board, isLoading: boardLoading } = useBoard(boardSlug);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Buscar clientes recentes
  const { data: recentClients = [], refetch } = useQuery({
    queryKey: ['recent-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as RecentClient[];
    },
  });

  // Contar total de clientes únicos
  const { data: totalClients = 0 } = useQuery({
    queryKey: ['total-clients-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    },
  });

  if (boardLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-foreground">Quadro não encontrado</h2>
          <p className="text-muted-foreground mt-2">O quadro solicitado não existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-card/30">
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground">
            {board.name}
          </h2>
          {board.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{board.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Tempo real
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário (ocupa 2 colunas) */}
          <div className="lg:col-span-2">
            <ClientRegistrationForm onSuccess={() => {
              refetch();
            }} compact />
          </div>

          {/* Sidebar com clientes recentes */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Total de Clientes</p>
                  <p className="text-2xl font-bold text-primary">{totalClients}</p>
                </div>
              </div>
            </div>

            {/* Clientes Recentes */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-muted-foreground" />
                Clientes Recentes
              </h3>

              {recentClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum cliente cadastrado ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentClients.map((client) => (
                    <div
                      key={client.id}
                      className="p-3 bg-muted/50 rounded-lg border border-border/50"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {client.name}
                      </p>
                      {client.razao_social && (
                        <p className="text-xs text-muted-foreground truncate">
                          {client.razao_social}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(client.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setSelectedClientId(client.id)}
                        >
                          <Eye className="w-3 h-3" />
                          Ver Cliente
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">Como funciona?</h4>
              <ol className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <span>Preencha todos os campos do formulário</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <span>Clique em "Cadastrar Cliente"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <span>Cards são criados automaticamente em 4 kanbans</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-success/10 text-success text-xs font-bold flex items-center justify-center flex-shrink-0">✓</span>
                  <span>Equipes recebem suas tarefas</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Client View Modal */}
      {selectedClientId && (
        <ClientViewModal
          isOpen={!!selectedClientId}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </div>
  );
}
