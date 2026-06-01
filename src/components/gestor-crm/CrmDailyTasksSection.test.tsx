import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CrmDailyTasksSection from './CrmDailyTasksSection';
import type { EnrichedCrmTask } from '@/hooks/useCrmDailyTasks';

// ---- Mocks ----

const mockUpdateMutate = vi.fn();

vi.mock('@/hooks/useCrmDailyTasks', () => ({
  useCrmDailyTasks: vi.fn(),
}));

const mockCreateMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useDepartmentTasks', () => ({
  useUpdateDepartmentTaskStatus: () => ({ mutate: mockUpdateMutate }),
  useCreateDepartmentTask: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useArchiveDepartmentTask: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteDepartmentTask: () => ({ mutate: vi.fn() }),
  useUnarchiveDepartmentTask: () => ({ mutate: vi.fn(), isPending: false }),
  useArchivedDepartmentTasks: () => ({ data: [] }),
}));

vi.mock('@/hooks/useCrmKanban', () => ({
  useCrmConfiguracoes: () => ({ data: [] }),
  CRM_PRODUTO_LABEL: { v8: 'V8', automation: 'Automation', copilot: 'Copilot' },
  CRM_PRODUTO_COLOR: {
    v8: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
    automation: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
    copilot: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
}));

vi.mock('@/hooks/useClientTags', () => ({
  useClientTagsBatch: () => ({ data: new Map() }),
}));

vi.mock('@/lib/confetti', () => ({
  fireCelebration: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'gestor_crm' } }),
}));

// Mock CrmConfigViewModal to avoid deep dependency tree
vi.mock('./CrmConfigViewModal', () => ({
  default: () => null,
}));

// ---- Helpers ----

import { useCrmDailyTasks } from '@/hooks/useCrmDailyTasks';
const mockUseCrmDailyTasks = vi.mocked(useCrmDailyTasks);

function makeTask(overrides: Partial<EnrichedCrmTask> & { status: 'todo' | 'doing' | 'done'; id?: string }): EnrichedCrmTask {
  const id = overrides.id || 'task-' + Math.random().toString(36).slice(2, 8);
  return {
    task: {
      id,
      user_id: 'user-1',
      title: overrides.task?.title || 'Test task',
      description: null,
      task_type: 'daily',
      status: overrides.status,
      priority: null,
      due_date: null,
      department: 'gestor_crm',
      related_client_id: null,
      created_at: '2026-05-26T10:00:00Z',
      updated_at: '2026-05-26T10:00:00Z',
      archived: false,
      archived_at: null,
      ...(overrides.task || {}),
    },
    produto: overrides.produto ?? null,
    configId: overrides.configId ?? null,
    stepKey: overrides.stepKey ?? null,
    checklistProgress: overrides.checklistProgress ?? null,
    isBlockedDN: overrides.isBlockedDN ?? false,
    blockedUntil: overrides.blockedUntil ?? null,
    deadlineStatus: overrides.deadlineStatus ?? 'none',
    urgencyBadge: overrides.urgencyBadge ?? null,
  };
}

function setup(tasks: { todo: EnrichedCrmTask[]; doing: EnrichedCrmTask[]; done: EnrichedCrmTask[] }) {
  const allTasks = [...tasks.todo, ...tasks.doing, ...tasks.done];
  mockUseCrmDailyTasks.mockReturnValue({
    grouped: tasks,
    enrichedTasks: allTasks,
    isLoading: false,
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CrmDailyTasksSection />
    </QueryClientProvider>,
  );
}

// ============================================================
// Slice 1: Three column headers with counts
// ============================================================

describe('CrmDailyTasksSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('column headers', () => {
    it('renders 3 columns: A Fazer, Fazendo, Feitas with task counts', () => {
      setup({
        todo: [makeTask({ status: 'todo' }), makeTask({ status: 'todo' })],
        doing: [makeTask({ status: 'doing' })],
        done: [],
      });

      // Column headers
      expect(screen.getByText('A Fazer')).toBeInTheDocument();
      expect(screen.getByText('Fazendo')).toBeInTheDocument();
      expect(screen.getByText('Feitas')).toBeInTheDocument();

      // Counts
      expect(screen.getByText('2')).toBeInTheDocument(); // todo count
      expect(screen.getByText('1')).toBeInTheDocument(); // doing count
      expect(screen.getByText('0')).toBeInTheDocument(); // done count
    });
  });

  // ============================================================
  // Slice 2: Tasks render in correct columns
  // ============================================================

  describe('task placement', () => {
    it('renders task titles in the document', () => {
      setup({
        todo: [makeTask({ status: 'todo', task: { title: 'Config V8 cliente X' } as any })],
        doing: [makeTask({ status: 'doing', task: { title: 'Automation em andamento' } as any })],
        done: [makeTask({ status: 'done', task: { title: 'Copilot finalizado' } as any })],
      });

      expect(screen.getByText('Config V8 cliente X')).toBeInTheDocument();
      expect(screen.getByText('Automation em andamento')).toBeInTheDocument();
      expect(screen.getByText('Copilot finalizado')).toBeInTheDocument();
    });

    it('renders client name when available', () => {
      setup({
        todo: [makeTask({
          status: 'todo',
          task: {
            title: 'Task with client',
            clients: { razao_social: 'Empresa ABC', name: 'ABC' },
          } as any,
        })],
        doing: [],
        done: [],
      });

      expect(screen.getByText('Empresa ABC')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Slice 3: Urgency badges
  // ============================================================

  describe('urgency badges', () => {
    it('renders ATRASADO badge for overdue tasks', () => {
      setup({
        todo: [makeTask({ status: 'todo', urgencyBadge: 'atrasado' })],
        doing: [],
        done: [],
      });

      expect(screen.getByTestId('urgency-atrasado')).toHaveTextContent('ATRASADO');
    });

    it('renders HOJE badge for today tasks', () => {
      setup({
        todo: [makeTask({ status: 'todo', urgencyBadge: 'hoje' })],
        doing: [],
        done: [],
      });

      expect(screen.getByTestId('urgency-hoje')).toHaveTextContent('HOJE');
    });

    it('renders D+N badge for blocked tasks', () => {
      setup({
        todo: [makeTask({ status: 'todo', urgencyBadge: 'dn' })],
        doing: [],
        done: [],
      });

      expect(screen.getByTestId('urgency-dn')).toHaveTextContent('D+N');
    });

    it('does not render urgency badge when null', () => {
      setup({
        todo: [makeTask({ status: 'todo', urgencyBadge: null })],
        doing: [],
        done: [],
      });

      expect(screen.queryByTestId('urgency-atrasado')).not.toBeInTheDocument();
      expect(screen.queryByTestId('urgency-hoje')).not.toBeInTheDocument();
      expect(screen.queryByTestId('urgency-dn')).not.toBeInTheDocument();
    });
  });

  // ============================================================
  // Slice 4: CRM enrichment badges
  // ============================================================

  describe('CRM enrichment', () => {
    it('renders produto badge', () => {
      setup({
        todo: [makeTask({ status: 'todo', produto: 'v8' })],
        doing: [],
        done: [],
      });

      expect(screen.getByText('V8')).toBeInTheDocument();
    });

    it('renders checklist progress', () => {
      setup({
        todo: [makeTask({ status: 'todo', checklistProgress: { done: 2, total: 4 } })],
        doing: [],
        done: [],
      });

      expect(screen.getByText('2/4')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Slice 5: Done cards styling
  // ============================================================

  describe('done card styling', () => {
    it('applies opacity-60 to done cards', () => {
      const { container } = setup({
        todo: [],
        doing: [],
        done: [makeTask({ status: 'done', task: { title: 'Completed task' } as any })],
      });

      // The draggable wrapper div should have opacity-60
      const card = container.querySelector('.opacity-60');
      expect(card).toBeInTheDocument();
    });

    it('applies line-through to done card title', () => {
      setup({
        todo: [],
        doing: [],
        done: [makeTask({ status: 'done', task: { title: 'Completed task' } as any })],
      });

      const title = screen.getByText('Completed task');
      expect(title).toHaveClass('line-through');
    });
  });

  // ============================================================
  // Slice 6: Empty state
  // ============================================================

  describe('empty state', () => {
    it('renders empty message when no tasks', () => {
      setup({ todo: [], doing: [], done: [] });

      expect(screen.getByText('Nenhuma tarefa CRM pendente')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Slice 7: Context menu (three-dot)
  // ============================================================

  describe('context menu', () => {
    it('renders action button when task has configId', () => {
      setup({
        todo: [makeTask({ status: 'todo', configId: 'cfg-123' })],
        doing: [],
        done: [],
      });

      expect(screen.getByLabelText('Ações da tarefa')).toBeInTheDocument();
    });

    it('renders action button even when task has no configId', () => {
      setup({
        todo: [makeTask({ status: 'todo', configId: null })],
        doing: [],
        done: [],
      });

      // Menu still shows move options even without configId
      expect(screen.getByLabelText('Ações da tarefa')).toBeInTheDocument();
    });
  });
});
