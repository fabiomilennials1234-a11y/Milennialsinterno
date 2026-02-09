import { KanbanBoard, KanbanCard, KanbanColumn } from '@/types/kanban';

// Apenas referência para seed/documentação. Dados reais vêm do Supabase (kanban_boards, etc.).
// Não é importado pelo app.
export const MOCK_DESIGN_BOARD: KanbanBoard = {
  id: 'design-board',
  title: 'Design',
  description: 'Kanban da equipe de Design',
  createdBy: '1',
  createdAt: '2024-01-01',
  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      status: 'backlog',
      cards: [
        {
          id: 'card-1',
          title: 'Redesign da Landing Page',
          description: 'Atualizar a landing page com o novo branding',
          priority: 'high',
          assigneeId: '5',
          dueDate: '2024-02-15',
          tags: ['branding', 'website'],
          createdAt: '2024-01-10',
          updatedAt: '2024-01-10',
          createdBy: '2',
          progress: 0,
        },
        {
          id: 'card-2',
          title: 'Ícones para App Mobile',
          description: 'Criar conjunto de ícones customizados',
          priority: 'medium',
          assigneeId: '5',
          tags: ['icons', 'mobile'],
          createdAt: '2024-01-12',
          updatedAt: '2024-01-12',
          createdBy: '2',
        },
      ],
    },
    {
      id: 'todo',
      title: 'A Fazer',
      status: 'todo',
      cards: [
        {
          id: 'card-3',
          title: 'Banners para Campanha Q1',
          description: 'Criar banners para redes sociais',
          priority: 'urgent',
          assigneeId: '5',
          dueDate: '2024-01-20',
          tags: ['social', 'campanha'],
          createdAt: '2024-01-08',
          updatedAt: '2024-01-08',
          createdBy: '3',
        },
      ],
    },
    {
      id: 'in_progress',
      title: 'Em Andamento',
      status: 'in_progress',
      cards: [
        {
          id: 'card-4',
          title: 'Kit de Apresentação Comercial',
          description: 'Desenvolver template de apresentação',
          priority: 'high',
          assigneeId: '5',
          dueDate: '2024-01-25',
          tags: ['comercial', 'apresentação'],
          createdAt: '2024-01-05',
          updatedAt: '2024-01-15',
          createdBy: '2',
          progress: 65,
        },
        {
          id: 'card-5',
          title: 'Infográfico de Resultados',
          description: 'Criar infográfico para relatório mensal',
          priority: 'medium',
          assigneeId: '5',
          tags: ['infográfico'],
          createdAt: '2024-01-14',
          updatedAt: '2024-01-15',
          createdBy: '4',
          progress: 30,
        },
      ],
    },
    {
      id: 'review',
      title: 'Em Revisão',
      status: 'review',
      cards: [
        {
          id: 'card-6',
          title: 'Logo Variações',
          description: 'Versões alternativas do logo para diferentes aplicações',
          priority: 'low',
          assigneeId: '5',
          tags: ['branding', 'logo'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-16',
          createdBy: '1',
          progress: 90,
        },
      ],
    },
    {
      id: 'done',
      title: 'Concluído',
      status: 'done',
      cards: [
        {
          id: 'card-7',
          title: 'Cartões de Visita',
          description: 'Design dos novos cartões de visita',
          priority: 'medium',
          assigneeId: '5',
          tags: ['print', 'branding'],
          createdAt: '2024-01-02',
          updatedAt: '2024-01-10',
          createdBy: '2',
          progress: 100,
        },
      ],
    },
  ],
};

export const MOCK_DEVS_BOARD: KanbanBoard = {
  id: 'devs-board',
  title: 'Desenvolvedores',
  description: 'Kanban da equipe de Desenvolvimento',
  createdBy: '1',
  createdAt: '2024-01-01',
  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      status: 'backlog',
      cards: [
        {
          id: 'dev-1',
          title: 'Integração API de Pagamentos',
          description: 'Integrar gateway de pagamento',
          priority: 'high',
          assigneeId: '7',
          tags: ['api', 'pagamentos'],
          createdAt: '2024-01-10',
          updatedAt: '2024-01-10',
          createdBy: '2',
        },
      ],
    },
    {
      id: 'todo',
      title: 'A Fazer',
      status: 'todo',
      cards: [
        {
          id: 'dev-2',
          title: 'Otimização de Performance',
          description: 'Melhorar tempo de carregamento',
          priority: 'medium',
          assigneeId: '7',
          tags: ['performance'],
          createdAt: '2024-01-12',
          updatedAt: '2024-01-12',
          createdBy: '2',
        },
      ],
    },
    {
      id: 'in_progress',
      title: 'Em Andamento',
      status: 'in_progress',
      cards: [
        {
          id: 'dev-3',
          title: 'Dashboard Analytics',
          description: 'Implementar painel de métricas',
          priority: 'urgent',
          assigneeId: '7',
          dueDate: '2024-01-22',
          tags: ['dashboard', 'analytics'],
          createdAt: '2024-01-08',
          updatedAt: '2024-01-16',
          createdBy: '1',
          progress: 45,
        },
      ],
    },
    {
      id: 'review',
      title: 'Em Revisão',
      status: 'review',
      cards: [],
    },
    {
      id: 'done',
      title: 'Concluído',
      status: 'done',
      cards: [
        {
          id: 'dev-4',
          title: 'Sistema de Login',
          description: 'Autenticação e autorização',
          priority: 'high',
          assigneeId: '7',
          tags: ['auth', 'segurança'],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-08',
          createdBy: '2',
          progress: 100,
        },
      ],
    },
  ],
};

// Função para obter board por ID
export function getBoardById(boardId: string): KanbanBoard | null {
  const boards: Record<string, KanbanBoard> = {
    'design': MOCK_DESIGN_BOARD,
    'devs': MOCK_DEVS_BOARD,
  };
  return boards[boardId] || null;
}

// Gerar board vazio
export function createEmptyBoard(id: string, title: string, createdBy: string): KanbanBoard {
  return {
    id,
    title,
    createdBy,
    createdAt: new Date().toISOString(),
    columns: [
      { id: 'backlog', title: 'Backlog', status: 'backlog', cards: [] },
      { id: 'todo', title: 'A Fazer', status: 'todo', cards: [] },
      { id: 'in_progress', title: 'Em Andamento', status: 'in_progress', cards: [] },
      { id: 'review', title: 'Em Revisão', status: 'review', cards: [] },
      { id: 'done', title: 'Concluído', status: 'done', cards: [] },
    ],
  };
}
