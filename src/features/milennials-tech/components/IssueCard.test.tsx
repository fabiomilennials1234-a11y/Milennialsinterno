import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueCard, type IssueCardData } from './IssueCard';
import { toIssueCardData } from '../lib/issueCardAdapter';
import type { BacklogIssue } from './backlogTypes';

function makeIssue(overrides: Partial<IssueCardData> = {}): IssueCardData {
  return {
    id: 'issue-1',
    key: 'AGS-12',
    title: 'Implementar board view',
    type: 'STORY',
    ...overrides,
  };
}

const makeRow = (over: Partial<BacklogIssue>): BacklogIssue => ({
  id: 'r1',
  key: 'AGS-1',
  title: 'Row issue',
  type: 'TASK',
  status: 'TODO',
  priority: 'MEDIUM',
  squad: 'FRONT',
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
  epicId: null,
  epicKey: null,
  epicTitle: null,
  sprintId: null,
  blocked: false,
  blockerReason: null,
  addedAfterStart: false,
  ...over,
});

describe('IssueCard', () => {
  it('renders without crashing and shows title + key', () => {
    render(<IssueCard issue={makeIssue()} />);
    expect(screen.getByText('Implementar board view')).toBeInTheDocument();
    expect(screen.getByText('AGS-12')).toBeInTheDocument();
  });

  it('reflects the issue type with the correct glyph', () => {
    const { container } = render(<IssueCard issue={makeIssue({ type: 'BUG' })} />);
    expect(container.querySelector('.lucide-circle-dot')).toBeInTheDocument();
  });

  it('shows story points when present', () => {
    render(<IssueCard issue={makeIssue({ storyPoints: 8 })} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('hides story points when unestimated', () => {
    render(<IssueCard issue={makeIssue({ storyPoints: null })} />);
    expect(screen.queryByLabelText(/ponto/)).not.toBeInTheDocument();
  });

  it('surfaces the blocked exception state', () => {
    render(<IssueCard issue={makeIssue({ isBlocked: true, blockerReason: 'dep externa' })} />);
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
  });

  it('surfaces the changes-requested exception state', () => {
    render(<IssueCard issue={makeIssue({ changesRequested: true })} />);
    expect(screen.getByText('Alterações')).toBeInTheDocument();
  });

  it('renders the epic chip when the issue belongs to an epic', () => {
    render(
      <IssueCard
        issue={makeIssue({ epicLabel: 'Checkout', epicColor: 'var(--mtech-epic-2)' })}
      />,
    );
    expect(screen.getByText('Checkout')).toBeInTheDocument();
  });

  it('shows the assignee initials', () => {
    render(<IssueCard issue={makeIssue({ assignee: { name: 'Gabriel Aurelio' } })} />);
    expect(screen.getByLabelText('Responsável: Gabriel Aurelio')).toBeInTheDocument();
  });

  it('marks an unassigned card accessibly', () => {
    render(<IssueCard issue={makeIssue({ assignee: null })} />);
    expect(screen.getByLabelText('Sem responsável')).toBeInTheDocument();
  });

  it('fires onClick with the issue id when clickable', () => {
    const onClick = vi.fn();
    render(<IssueCard issue={makeIssue()} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('issue-1');
  });

  it('is not a button when no onClick is given', () => {
    render(<IssueCard issue={makeIssue()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('IssueCard — epic + sub-task from the board read model (#173)', () => {
  it('shows the epic chip (key) when the board row belongs to an epic', () => {
    render(<IssueCard issue={toIssueCardData(makeRow({ epicId: 'e1', epicKey: 'AGS-E1' }))} />);
    expect(screen.getByText('AGS-E1')).toBeInTheDocument();
  });

  it('shows no epic chip when the row has no epic', () => {
    render(<IssueCard issue={toIssueCardData(makeRow({ epicId: null, epicKey: null }))} />);
    expect(screen.queryByText(/-E\d/)).not.toBeInTheDocument();
  });

  it('shows a done/total sub-task badge when the row owns sub-tasks', () => {
    render(
      <IssueCard issue={toIssueCardData(makeRow({ subtaskProgress: { done: 2, total: 5 } }))} />,
    );
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByLabelText('2 de 5 sub-tarefas concluídas')).toBeInTheDocument();
  });

  it('shows no sub-task badge when the row owns none', () => {
    render(<IssueCard issue={toIssueCardData(makeRow({}))} />);
    expect(screen.queryByLabelText(/sub-tarefas concluídas/)).not.toBeInTheDocument();
  });
});
