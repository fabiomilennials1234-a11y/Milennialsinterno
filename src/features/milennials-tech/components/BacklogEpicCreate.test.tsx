import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BacklogEpicCreate } from './BacklogEpicCreate';

function renderWith(
  props: Partial<React.ComponentProps<typeof BacklogEpicCreate>> = {},
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  render(
    <QueryClientProvider client={client}>
      <BacklogEpicCreate projectId="p1" projectLabel="Agros" {...props} />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  rpc.mockReset();
});

describe('BacklogEpicCreate', () => {
  it('renders a "Nova Epic" button', () => {
    renderWith();
    expect(screen.getByRole('button', { name: /Nova Epic/i })).toBeInTheDocument();
  });

  it('disables the button when there is no current project', () => {
    renderWith({ projectId: null, projectLabel: null });
    expect(screen.getByRole('button', { name: /Nova Epic/i })).toBeDisabled();
  });

  it('opens the EpicFormModal scoped to the current project on click', async () => {
    const user = userEvent.setup();
    renderWith();
    expect(screen.queryByText('Novo epic')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Nova Epic/i }));
    expect(screen.getByText('Novo epic')).toBeInTheDocument();
    expect(screen.getByText(/Agros/)).toBeInTheDocument();
  });

  it('creates the epic under the current project and refreshes the epic list', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: 'epic-id', error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderWith({}, client);

    await user.click(screen.getByRole('button', { name: /Nova Epic/i }));
    await user.type(screen.getByLabelText('Título'), 'Checkout reativo');
    await user.click(screen.getByRole('button', { name: 'Criar epic' }));

    await vi.waitFor(() => {
      expect(rpc).toHaveBeenCalledWith(
        'tech_epic_create',
        expect.objectContaining({ p_project_id: 'p1', p_title: 'Checkout reativo' }),
      );
    });
    const invalidatedKeys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidatedKeys).toContain(JSON.stringify(['tech', 'epics']));
  });
});
