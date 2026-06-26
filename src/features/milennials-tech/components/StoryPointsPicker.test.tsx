import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoryPointsPicker } from './StoryPointsPicker';

// Radix Popover drives open/close on pointer capture; jsdom implements none of
// it. Polyfill so the popover actually opens and the grid is exercisable.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('StoryPointsPicker', () => {
  it('renders the current value in the closed trigger', () => {
    render(<StoryPointsPicker value={5} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /estimativa: 5 pontos/i })).toHaveTextContent('5');
  });

  it('renders a dash trigger when unestimated', () => {
    render(<StoryPointsPicker value={null} onChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /definir estimativa/i });
    expect(trigger).toHaveTextContent('–');
  });

  it('opens the Fibonacci scale on trigger click', async () => {
    const user = userEvent.setup();
    render(<StoryPointsPicker value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /definir estimativa/i }));

    for (const n of [1, 2, 3, 5, 8, 13]) {
      expect(
        screen.getByRole('button', { name: `${n} ${n === 1 ? 'ponto' : 'pontos'}` }),
      ).toBeInTheDocument();
    }
  });

  it('calls onChange with the chosen Fibonacci value and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StoryPointsPicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /definir estimativa/i }));
    await user.click(screen.getByRole('button', { name: '8 pontos' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(8);
    // popover closed → grid option gone
    expect(screen.queryByRole('button', { name: '8 pontos' })).not.toBeInTheDocument();
  });

  it('marks the current value as pressed in the grid', async () => {
    const user = userEvent.setup();
    render(<StoryPointsPicker value={3} onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /estimativa: 3 pontos/i }));

    expect(screen.getByRole('button', { name: '3 pontos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '5 pontos' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('does not re-fire onChange when re-selecting the current value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StoryPointsPicker value={3} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /estimativa: 3 pontos/i }));
    await user.click(screen.getByRole('button', { name: '3 pontos' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers no clear/remove affordance — only Fibonacci values', async () => {
    const user = userEvent.setup();
    render(<StoryPointsPicker value={5} onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /estimativa: 5 pontos/i }));

    expect(screen.queryByRole('button', { name: /limpar|remover|nenhum|sem estimativa/i })).toBeNull();
    // exactly 6 Fibonacci options inside the group
    const group = screen.getByRole('group', { name: /pontos de estimativa/i });
    expect(group.querySelectorAll('button')).toHaveLength(6);
  });

  it('disables the trigger while a mutation is pending', () => {
    render(<StoryPointsPicker value={5} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: /estimativa: 5 pontos/i })).toBeDisabled();
  });
});
