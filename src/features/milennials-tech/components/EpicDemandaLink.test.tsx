import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EpicDemandaLink } from './EpicDemandaLink';
import type { DemandaOption } from './EpicDemandaField';

// Popover + the nested Radix Select both ride pointer capture / scrollIntoView.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const opt = (over: Partial<DemandaOption> = {}): DemandaOption => ({
  id: 'd1',
  titulo: 'Reformular landing de planos',
  status: 'em_andamento',
  dominio: 'design',
  ...over,
});

const options = [opt(), opt({ id: 'd2', titulo: 'Vídeo institucional', status: 'aberta', dominio: 'video' })];

describe('EpicDemandaLink', () => {
  it('renders the linked chip with title + humanized status', () => {
    render(
      <EpicDemandaLink scope="ready" current={opt()} options={options} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Reformular landing de planos')).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
  });

  it('renders the ghost "Vincular demanda" affordance when unlinked', () => {
    render(<EpicDemandaLink scope="ready" current={null} options={options} onChange={vi.fn()} />);
    expect(screen.getByText('Vincular demanda')).toBeInTheDocument();
  });

  it('renders nothing for an internal project with no link', () => {
    const { container } = render(
      <EpicDemandaLink scope="internal" current={null} options={[]} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('still shows the chip for an internal project that already has a link', () => {
    render(
      <EpicDemandaLink scope="internal" current={opt()} options={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Reformular landing de planos')).toBeInTheDocument();
  });

  it('opens the popover and relinks: fires onChange with the picked id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicDemandaLink scope="ready" current={null} options={options} onChange={onChange} />);

    await user.click(screen.getByText('Vincular demanda'));
    // Field's Select trigger lives inside the popover.
    await user.click(screen.getByLabelText('Vincular demanda do cliente'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Vídeo institucional'));

    expect(onChange).toHaveBeenCalledWith('d2');
  });
});
