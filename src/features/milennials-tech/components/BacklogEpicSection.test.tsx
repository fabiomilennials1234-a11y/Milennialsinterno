import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacklogEpicSection } from './BacklogEpicSection';
import type { EpicSection } from '../lib/groupByEpic';
import type { BacklogIssue } from './backlogTypes';

const makeIssue = (over: Partial<BacklogIssue>): BacklogIssue => ({
  id: 'id',
  key: 'AGS-1',
  title: 'Default issue',
  type: 'TASK',
  status: 'BACKLOG',
  priority: 'MEDIUM',
  squad: null,
  storyPoints: null,
  assigneeId: null,
  assigneeName: null,
  assigneeAvatar: null,
  rank: 'V',
  projectId: 'p1',
  projectName: 'Agros',
  projectPrefix: 'AGS',
  clientId: null,
  clientName: null,
  epicId: 'e1',
  epicKey: 'AGS-E1',
  epicTitle: 'Checkout',
  sprintId: null,
  blocked: false,
  blockerReason: null,
  addedAfterStart: false,
  ...over,
});

const epicSection: EpicSection = {
  epic: { id: 'e1', title: 'Checkout', key: 'AGS-E1' },
  issues: [makeIssue({ id: 'a', title: 'Refatorar carrinho' })],
  rollup: { totalPoints: 8, donePoints: 2, progressPct: 33, issueCount: 3, doneCount: 1 },
};

function setup(props: Partial<React.ComponentProps<typeof BacklogEpicSection>> = {}) {
  const onToggle = vi.fn();
  render(
    <BacklogEpicSection section={epicSection} collapsed={false} onToggle={onToggle} {...props} />,
  );
  return { onToggle };
}

describe('BacklogEpicSection (#170)', () => {
  it('renders the epic title and a "{pts} pts · {n} issues" rollup', () => {
    setup();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
    expect(screen.getByText('8 pts · 3 issues')).toBeInTheDocument();
  });

  it('renders the issues when expanded (aria-expanded=true)', () => {
    setup({ collapsed: false });
    expect(screen.getByText('Refatorar carrinho')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Checkout/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides the issues when collapsed (aria-expanded=false)', () => {
    setup({ collapsed: true });
    expect(screen.queryByText('Refatorar carrinho')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Checkout/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles on header click', async () => {
    const user = userEvent.setup();
    const { onToggle } = setup();
    await user.click(screen.getByRole('button', { name: /Checkout/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('hides the epic chip on its rows (rail + header already carry identity)', () => {
    setup();
    // The row would show "AGS-E1" as an epic chip only if showEpicChip were true.
    expect(screen.queryByText('AGS-E1')).not.toBeInTheDocument();
  });

  it('labels the null section "Sem Epic" and keeps "0 pts" visible', () => {
    render(
      <BacklogEpicSection
        section={{
          epic: null,
          issues: [makeIssue({ id: 'l', epicId: null, epicKey: null })],
          rollup: { totalPoints: 0, donePoints: 0, progressPct: 0, issueCount: 1, doneCount: 0 },
        }}
        collapsed={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('Sem Epic')).toBeInTheDocument();
    expect(screen.getByText('0 pts · 1 issue')).toBeInTheDocument();
  });
});
