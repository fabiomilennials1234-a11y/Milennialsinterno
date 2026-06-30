import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacklogFilterBar } from './BacklogFilterBar';
import { EMPTY_BACKLOG_FILTERS } from './backlogTypes';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function setup(props: Partial<React.ComponentProps<typeof BacklogFilterBar>> = {}) {
  const onChange = vi.fn();
  const onGroupedChange = vi.fn();
  render(
    <BacklogFilterBar
      projects={[]}
      clients={[]}
      assignees={[]}
      filters={EMPTY_BACKLOG_FILTERS}
      onChange={onChange}
      grouped
      onGroupedChange={onGroupedChange}
      {...props}
    />,
  );
  return { onChange, onGroupedChange };
}

describe('BacklogFilterBar — grouping toggle (#170)', () => {
  it('shows the toggle pressed when grouping is on', () => {
    setup({ grouped: true });
    expect(screen.getByRole('button', { name: 'Agrupar por História' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the toggle unpressed when grouping is off', () => {
    setup({ grouped: false });
    expect(screen.getByRole('button', { name: 'Agrupar por História' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('flips grouping on click', async () => {
    const user = userEvent.setup();
    const { onGroupedChange } = setup({ grouped: true });
    await user.click(screen.getByRole('button', { name: 'Agrupar por História' }));
    expect(onGroupedChange).toHaveBeenCalledWith(false);
  });

  it('omits the toggle when no handler is wired', () => {
    setup({ onGroupedChange: undefined });
    expect(screen.queryByRole('button', { name: 'Agrupar por História' })).not.toBeInTheDocument();
  });
});
