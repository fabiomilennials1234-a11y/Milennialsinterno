import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EpicDemandaField, type DemandaOption } from './EpicDemandaField';

// Radix Select drives its open/close on pointer capture + scrollIntoView, neither
// of which jsdom implements. Polyfill them so the dropdown can actually open and
// onChange wiring is exercisable (not just the closed-trigger render states).
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

const options = [
  opt(),
  opt({ id: 'd2', titulo: 'Vídeo institucional', status: 'aberta', dominio: 'video' }),
];

describe('EpicDemandaField', () => {
  it('renders the linked demand (title + humanized status) in the closed trigger', () => {
    render(
      <EpicDemandaField scope="ready" options={options} value="d1" onChange={vi.fn()} />,
    );
    expect(screen.getByText('Reformular landing de planos')).toBeInTheDocument();
    // "em_andamento" → "Em andamento"
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
  });

  it('renders an enabled, unselected trigger when value is null', () => {
    render(<EpicDemandaField scope="ready" options={options} value={null} onChange={vi.fn()} />);
    const trigger = screen.getByLabelText('Vincular demanda do cliente');
    expect(trigger).toBeInTheDocument();
    expect(trigger).not.toBeDisabled();
    // No demand resolved → no demand title shown in the closed trigger.
    expect(screen.queryByText('Reformular landing de planos')).not.toBeInTheDocument();
  });

  it('disables the trigger and explains the empty-client scope', () => {
    render(<EpicDemandaField scope="empty" options={[]} value={null} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Vincular demanda do cliente')).toBeDisabled();
    expect(
      screen.getByText(/ainda não tem demandas abertas/i),
    ).toBeInTheDocument();
  });

  it('renders the locked note for internal projects (no select)', () => {
    render(<EpicDemandaField scope="internal" options={[]} value={null} onChange={vi.fn()} />);
    expect(
      screen.getByText(/Projeto interno — sem demanda de cliente/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Vincular demanda do cliente')).not.toBeInTheDocument();
  });

  it('hides the optional tag when hideOptionalTag is set', () => {
    const { rerender } = render(
      <EpicDemandaField scope="ready" options={options} value={null} onChange={vi.fn()} />,
    );
    expect(screen.getByText('opcional')).toBeInTheDocument();
    rerender(
      <EpicDemandaField
        scope="ready"
        options={options}
        value={null}
        onChange={vi.fn()}
        hideOptionalTag
      />,
    );
    expect(screen.queryByText('opcional')).not.toBeInTheDocument();
  });

  it('fires onChange with the demand id when a demand is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicDemandaField scope="ready" options={options} value={null} onChange={onChange} />);

    await user.click(screen.getByLabelText('Vincular demanda do cliente'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Vídeo institucional'));

    expect(onChange).toHaveBeenCalledWith('d2');
  });

  it('fires onChange with null when "Sem demanda" is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicDemandaField scope="ready" options={options} value="d1" onChange={onChange} />);

    await user.click(screen.getByLabelText('Vincular demanda do cliente'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Sem demanda'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
