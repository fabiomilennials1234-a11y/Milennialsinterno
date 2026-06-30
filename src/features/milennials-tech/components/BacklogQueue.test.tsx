import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacklogQueue } from './BacklogQueue';
import { NO_EPIC_KEY, type EpicSection } from '../lib/groupByEpic';
import type { BacklogIssue } from './backlogTypes';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const makeIssue = (over: Partial<BacklogIssue>): BacklogIssue => ({
  id: 'id',
  key: 'AGS-1',
  title: 'Default',
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

const sections: EpicSection[] = [
  {
    epic: { id: 'e1', title: 'Checkout', key: 'AGS-E1' },
    issues: [makeIssue({ id: 'a', title: 'Issue do checkout' })],
    rollup: { totalPoints: 8, donePoints: 0, progressPct: 0, issueCount: 1, doneCount: 0 },
  },
  {
    epic: null,
    issues: [makeIssue({ id: 'b', title: 'Issue solta', epicId: null, epicKey: null, epicTitle: null })],
    rollup: { totalPoints: 0, donePoints: 0, progressPct: 0, issueCount: 1, doneCount: 0 },
  },
];

const flatIssues = [
  makeIssue({ id: 'a', title: 'Issue do checkout' }),
  makeIssue({ id: 'b', title: 'Issue solta', epicId: null, epicKey: null }),
];

function grouped(props: Partial<React.ComponentProps<typeof BacklogQueue>> = {}) {
  const onToggleCollapse = vi.fn();
  render(
    <BacklogQueue
      issues={flatIssues}
      grouped
      sections={sections}
      collapsedEpicIds={new Set()}
      onToggleCollapse={onToggleCollapse}
      onReorder={vi.fn()}
      {...props}
    />,
  );
  return { onToggleCollapse };
}

describe('BacklogQueue — grouped by epic (#170)', () => {
  it('renders a section per epic, with the "Sem Epic" section present', () => {
    grouped();
    expect(screen.getByRole('button', { name: /Checkout/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sem Epic/ })).toBeInTheDocument();
  });

  it('hides a section body when its key is collapsed', () => {
    grouped({ collapsedEpicIds: new Set(['e1']) });
    expect(screen.queryByText('Issue do checkout')).not.toBeInTheDocument();
    expect(screen.getByText('Issue solta')).toBeInTheDocument();
  });

  it('toggles collapse by epic id on header click', async () => {
    const user = userEvent.setup();
    const { onToggleCollapse } = grouped();
    await user.click(screen.getByRole('button', { name: /Checkout/ }));
    expect(onToggleCollapse).toHaveBeenCalledWith('e1');
  });

  it('toggles the "Sem Epic" section under its sentinel key', async () => {
    const user = userEvent.setup();
    const { onToggleCollapse } = grouped();
    await user.click(screen.getByRole('button', { name: /Sem Epic/ }));
    expect(onToggleCollapse).toHaveBeenCalledWith(NO_EPIC_KEY);
  });

  it('shows the epic chip in flat mode and hides it when grouped', () => {
    const { unmount } = render(
      <BacklogQueue issues={flatIssues} onReorder={vi.fn()} />,
    );
    expect(screen.getByText('AGS-E1')).toBeInTheDocument(); // flat → chip visible
    unmount();

    grouped();
    expect(screen.queryByText('AGS-E1')).not.toBeInTheDocument(); // grouped → chip hidden
  });
});
