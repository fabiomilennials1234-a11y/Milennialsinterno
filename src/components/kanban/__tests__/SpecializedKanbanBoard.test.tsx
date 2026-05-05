// Regressão P0: SpecializedKanbanBoard não pode crashar quando
// `config.delay.useDelayedCards().data` retorna undefined (primeiro render
// de useQuery). Antes do fix, acessávamos `.length` em undefined no useEffect
// linha 220-223 e o ErrorBoundary assumia, bloqueando 8 cargos não-executivos.

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// -------- Mocks de dependências externas --------

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'design' },
  }),
}));

// Supabase client: retornamos um builder fluente que resolve com data vazia.
// Qualquer `.from(...).select(...).eq(...).maybeSingle()` etc cai aqui.
vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {};
  const chain = new Proxy(builder, {
    get(_target, prop) {
      if (prop === 'then') {
        // torna o builder "thenable" — qualquer await retorna { data, error }
        return (resolve: (v: unknown) => void) =>
          resolve({ data: [], error: null });
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => Promise.resolve({ data: null, error: null });
      }
      return () => chain;
    },
  });
  return {
    supabase: {
      from: () => chain,
      storage: { from: () => chain },
    },
  };
});

// CardDetailModal traz dependências transitivas pesadas — stub.
vi.mock('@/components/kanban/CardDetailModal', () => ({
  default: () => null,
}));

// -------- Import após mocks --------

import SpecializedKanbanBoard, {
  type SpecializedBoardConfig,
} from '@/components/kanban/SpecializedKanbanBoard';

// -------- Helpers --------

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

const DummyCreateModal: SpecializedBoardConfig['CreateCardModal'] = () => null;
const DummyDelayModal: NonNullable<SpecializedBoardConfig['delay']>['DelayModal'] =
  () => null;

function makeConfig(
  delayedData: unknown[] | undefined
): SpecializedBoardConfig {
  return {
    boardSlugLike: 'design',
    boardQueryKeyPrefix: 'design-test',
    cardType: 'design',
    fallbackStatus: 'a_fazer',
    personsRole: 'design',
    personsEmptyMessage: 'Nenhum',
    statuses: [
      { id: 'a_fazer', label: 'A FAZER', color: 'bg-blue-500' },
    ] as const,
    columnDotClass: 'bg-primary',
    useCardCreators: () => ({ data: {} }),
    delay: {
      useDelayedCards: () => ({ data: delayedData as unknown[] }),
      useJustifications: () => ({ data: [] }),
      DelayModal: DummyDelayModal,
      showModalForRole: 'design',
    },
    CreateCardModal: DummyCreateModal,
    createModalColumnPropName: 'designerColumns',
    createSuccessMessage: 'ok',
    cardDetailFlags: { isDesignBoard: true },
  };
}

// -------- Tests --------

describe('SpecializedKanbanBoard — delayedCards guard', () => {
  it('não crasha quando useDelayedCards retorna data: undefined (primeiro render de useQuery)', () => {
    const config = makeConfig(undefined);
    expect(() =>
      renderWithClient(<SpecializedKanbanBoard config={config} />)
    ).not.toThrow();
  });

  it('renderiza sem erro quando useDelayedCards retorna data: []', () => {
    const config = makeConfig([]);
    const { container } = renderWithClient(
      <SpecializedKanbanBoard config={config} />
    );
    expect(container).toBeTruthy();
  });

  it('renderiza sem erro quando useDelayedCards retorna data com 1 card', () => {
    const config = makeConfig([
      { id: 'c1', title: 'Card atrasado', due_date: '2024-01-01' },
    ]);
    const { container } = renderWithClient(
      <SpecializedKanbanBoard config={config} />
    );
    expect(container).toBeTruthy();
  });
});
