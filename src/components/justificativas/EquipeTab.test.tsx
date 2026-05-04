import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EquipeTab from './EquipeTab';

const teamMock = vi.fn();
vi.mock('@/hooks/useJustificativas', () => ({
  useJustificativasTeam: (only: boolean) => teamMock(only),
  useNudgeUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRequestRevision: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveJustification: () => ({ mutate: vi.fn() }),
}));

function renderTab() {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}><EquipeTab /></QueryClientProvider>);
}

describe('EquipeTab', () => {
  it('agrupa itens por user_id', () => {
    teamMock.mockReturnValue({
      data: [
        { user_id: 'u1', user_name: 'Ana', user_role: 'design', notification_id: 'n1', task_title: 'A', task_due_date: '2026-04-01', justification_id: null, requires_revision: false, archived: false, created_at: '2026-04-01' },
        { user_id: 'u1', user_name: 'Ana', user_role: 'design', notification_id: 'n2', task_title: 'B', task_due_date: '2026-04-02', justification_id: null, requires_revision: false, archived: false, created_at: '2026-04-02' },
        { user_id: 'u2', user_name: 'Beto', user_role: 'devs', notification_id: 'n3', task_title: 'C', task_due_date: '2026-04-03', justification_id: 'j1', requires_revision: false, archived: false, created_at: '2026-04-03' },
      ],
      isLoading: false,
    });
    renderTab();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('toggle "só não-justificadas" passa true para o hook', () => {
    teamMock.mockReturnValue({ data: [], isLoading: false });
    renderTab();
    fireEvent.click(screen.getByRole('switch'));
    const lastCallArg = teamMock.mock.calls[teamMock.mock.calls.length - 1][0];
    expect(lastCallArg).toBe(true);
  });
});
