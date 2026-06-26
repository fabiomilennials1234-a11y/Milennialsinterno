import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EpicFormModal, type EpicCreatePayload } from './EpicFormModal';
import type { DemandaOption } from './EpicDemandaField';

// The nested demand Select needs the same jsdom pointer polyfills.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const demandas: DemandaOption[] = [
  { id: 'd1', titulo: 'Reformular landing de planos', status: 'em_andamento', dominio: 'design' },
  { id: 'd2', titulo: 'Vídeo institucional', status: 'aberta', dominio: 'video' },
];

function setup(props: Partial<React.ComponentProps<typeof EpicFormModal>> = {}) {
  const onSubmit = vi.fn<(p: EpicCreatePayload) => void>();
  const onOpenChange = vi.fn();
  render(
    <EpicFormModal
      open
      onOpenChange={onOpenChange}
      demandaScope="ready"
      demandas={demandas}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onOpenChange };
}

describe('EpicFormModal', () => {
  it('renders the title field and the demand block for a client-scoped project', () => {
    setup();
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
    expect(screen.getByLabelText('Vincular demanda do cliente')).toBeInTheDocument();
  });

  it('omits the demand block for an internal project', () => {
    setup({ demandaScope: 'internal' });
    expect(screen.queryByLabelText('Vincular demanda do cliente')).not.toBeInTheDocument();
  });

  it('keeps submit disabled until the title is at least 3 chars', async () => {
    const user = userEvent.setup();
    setup();
    const submit = screen.getByRole('button', { name: 'Criar epic' });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Título'), 'ab');
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Título'), 'c');
    expect(submit).not.toBeDisabled();
  });

  it('submits a trimmed payload with demandaId null when nothing is linked', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText('Título'), '  Checkout reativo  ');
    await user.click(screen.getByRole('button', { name: 'Criar epic' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Checkout reativo',
      description: null,
      startDate: null,
      deadline: null,
      demandaId: null,
    });
  });

  it('threads the picked demand id into the submit payload', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText('Título'), 'Epic com demanda');

    await user.click(screen.getByLabelText('Vincular demanda do cliente'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Vídeo institucional'));

    await user.click(screen.getByRole('button', { name: 'Criar epic' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ demandaId: 'd2' }));
  });

  it('forces demandaId null for internal projects even after submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ demandaScope: 'internal' });
    await user.type(screen.getByLabelText('Título'), 'Epic interno');
    await user.click(screen.getByRole('button', { name: 'Criar epic' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ demandaId: null }));
  });

  it('surfaces an inline server error (e.g. 23503 demanda inexistente)', () => {
    setup({ error: 'A demanda informada não existe.' });
    expect(screen.getByText('A demanda informada não existe.')).toBeInTheDocument();
  });

  it('shows the submitting label and blocks submit while saving', () => {
    setup({ isSubmitting: true });
    expect(screen.getByRole('button', { name: 'Criando...' })).toBeDisabled();
  });

  it('shows a validation error when submitting an empty title', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    // Blur with empty value to trip the touched-title error path.
    await user.click(screen.getByLabelText('Título'));
    await user.tab();
    expect(screen.getByText('Dê um título ao epic.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
