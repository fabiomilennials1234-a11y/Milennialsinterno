import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import { TECH_TASK_TYPES } from '../lib/taskTypeVisual';
import { getFriendlyTypeLabel } from '../lib/statusLabels';
import type { TechTask } from '../types';

// Isolate the card from its data hooks — the regression is purely in the
// synchronous type→config lookup at render time, so deterministic empty data
// is enough to reproduce / prove the fix.
vi.mock('../hooks/useProfiles', () => ({
  useProfileMap: () => ({}),
  getInitials: (name: string) => name.slice(0, 2).toUpperCase(),
}));
vi.mock('../hooks/useTechProjects', () => ({
  useProjectNameMap: () => ({}),
}));
vi.mock('../hooks/useTechTags', () => ({
  useTechTags: () => ({ data: [] }),
  useTechTaskTags: () => ({ data: [] }),
}));
vi.mock('../hooks/useTechTimeTotals', () => ({
  useTechTimeTotals: () => ({ data: {} }),
  formatTimeTotal: () => '',
}));
vi.mock('./TimerButton', () => ({ TimerButton: () => null }));
vi.mock('./TagPicker', () => ({ TaskTagBadges: () => null }));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => (props: Record<string, unknown>) => {
    const { children, ...rest } = props as { children?: React.ReactNode };
    // strip motion-only props that React would warn on
    delete (rest as Record<string, unknown>).layout;
    delete (rest as Record<string, unknown>).layoutId;
    return <div {...rest}>{children}</div>;
  } }),
}));

function makeTask(overrides: Partial<TechTask> = {}): TechTask {
  return {
    id: 'task-1',
    title: 'Tarefa de exemplo',
    type: 'STORY',
    priority: 'MEDIUM',
    status: 'TODO',
    assignee_id: null,
    created_by: 'user-1',
    is_blocked: false,
    ...overrides,
  } as unknown as TechTask;
}

describe('TaskCard — type resolution (regression: PROD white-screen on STORY/TASK)', () => {
  it('renders a STORY card without crashing and shows its type label + title', () => {
    const { container, getByText } = render(
      <TaskCard task={makeTask({ type: 'STORY', title: 'História X' })} onClick={() => {}} />,
    );
    expect(container.textContent).toContain(getFriendlyTypeLabel('STORY').label);
    expect(getByText('História X')).toBeInTheDocument();
  });

  it('renders a TASK card without crashing and shows its type label', () => {
    const { container } = render(<TaskCard task={makeTask({ type: 'TASK' })} onClick={() => {}} />);
    expect(container.textContent).toContain(getFriendlyTypeLabel('TASK').label);
  });

  it.each(TECH_TASK_TYPES)('renders every enum type without crashing: %s', (type) => {
    expect(() =>
      render(<TaskCard task={makeTask({ type })} onClick={() => {}} />),
    ).not.toThrow();
  });

  it.each(TECH_TASK_TYPES)('shows the friendly type label for %s', (type) => {
    const { container } = render(<TaskCard task={makeTask({ type })} onClick={() => {}} />);
    expect(container.textContent).toContain(getFriendlyTypeLabel(type).label);
  });
});
