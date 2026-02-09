import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StrategyRequest {
  id: string;
  client_id: string;
  requested_by: string;
  requested_at: string;
  completed: boolean;
  completed_at: string | null;
  kanban_card_id: string | null;
  created_at: string;
}

export function useStrategyRequest(clientId: string) {
  return useQuery({
    queryKey: ['strategy-request', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategy_requests')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as StrategyRequest | null;
    },
    enabled: !!clientId,
  });
}

export function useRequestStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      clientName, 
      niche, 
      expectedInvestment 
    }: { 
      clientId: string; 
      clientName: string;
      niche: string | null;
      expectedInvestment: number | null;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Find the gestor de projetos board for the client's group
      const { data: client } = await supabase
        .from('clients')
        .select('group_id')
        .eq('id', clientId)
        .single();

      let boardId: string | null = null;

      // Try to find the board for the client's group
      if (client?.group_id) {
        const { data: board } = await supabase
          .from('kanban_boards')
          .select('id')
          .eq('group_id', client.group_id)
          .ilike('slug', '%projetos%')
          .limit(1)
          .maybeSingle();
        
        if (board) boardId = board.id;
      }

      // Fallback to any projetos board
      if (!boardId) {
        const { data: board } = await supabase
          .from('kanban_boards')
          .select('id')
          .ilike('slug', '%projetos%')
          .limit(1)
          .maybeSingle();
        
        if (board) boardId = board.id;
      }

      if (!boardId) {
        throw new Error('Não foi encontrado um board do Gestor de Projetos');
      }

      // Get or create a column for strategy requests
      let columnId: string | null = null;
      
      const { data: existingColumn } = await supabase
        .from('kanban_columns')
        .select('id')
        .eq('board_id', boardId)
        .eq('title', 'Estratégias a Criar')
        .maybeSingle();

      if (existingColumn) {
        columnId = existingColumn.id;
      } else {
        // Get max position
        const { data: columns } = await supabase
          .from('kanban_columns')
          .select('position')
          .eq('board_id', boardId)
          .order('position', { ascending: false })
          .limit(1);

        const maxPosition = columns?.[0]?.position ?? -1;

        const { data: newColumn, error: columnError } = await supabase
          .from('kanban_columns')
          .insert({
            board_id: boardId,
            title: 'Estratégias a Criar',
            position: maxPosition + 1,
            color: '#f59e0b',
          })
          .select('id')
          .single();

        if (columnError) throw columnError;
        columnId = newColumn.id;
      }

      // Format investment for description
      const investmentFormatted = expectedInvestment 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expectedInvestment)
        : 'Não informado';

      // Create the kanban card
      const { data: card, error: cardError } = await supabase
        .from('kanban_cards')
        .insert({
          board_id: boardId,
          column_id: columnId,
          title: `Criar Estratégia: ${clientName}`,
          description: `**Nicho:** ${niche || 'Não informado'}\n**Investimento:** ${investmentFormatted}`,
          client_id: clientId,
          card_type: 'strategy_request',
          created_by: user.id,
          priority: 'high',
        })
        .select('id')
        .single();

      if (cardError) throw cardError;

      // Create the strategy request record
      const { error: requestError } = await supabase
        .from('strategy_requests')
        .insert({
          client_id: clientId,
          requested_by: user.id,
          kanban_card_id: card.id,
        } as any);

      if (requestError) throw requestError;

      return card;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['strategy-request', variables.clientId] });
      toast.success('Solicitação de estratégia enviada!', {
        description: 'O card foi criado no kanban do Gestor de Projetos.',
      });
    },
    onError: (error: any) => {
      toast.error('Erro ao solicitar estratégia', { description: error.message });
    },
  });
}
