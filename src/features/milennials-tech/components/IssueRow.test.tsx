import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IssueRow } from './IssueRow';
import type { BacklogIssue } from './backlogTypes';

const makeIssue = (over: Partial<BacklogIssue> = {}): BacklogIssue => ({
  id: 'id',
  key: 'AGS-1',
  title: 'Default',
  type: 'TASK',
  status: 'BACKLOG',
  priority: 'MEDIUM',
  squad: 'FRONT',
  storyPoints: null,
  assigneeId: null,
  assigneeName: null,
  assigneeAvatar: null,
  rank: 'V',
  projectId: 'p1',
  projectName: 'Agenda',
  projectPrefix: 'AGS',
  clientId: null,
  clientName: null,
  epicId: null,
  sprintId: null,
  blocked: false,
  blockerReason: null,
  addedAfterStart: false,
  ...over,
});

describe('IssueRow — sub-task progress badge (#171)', () => {
  it('renders a done/total badge when the issue owns sub-tasks', () => {
    render(<IssueRow issue={makeIssue({ subtaskProgress: { done: 1, total: 3 } })} />);
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(
      screen.getByLabelText('1 de 3 sub-tarefas concluídas'),
    ).toBeInTheDocument();
  });

  it('shows the exact done/total figure', () => {
    render(<IssueRow issue={makeIssue({ subtaskProgress: { done: 4, total: 4 } })} />);
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('renders NO badge when the issue has no sub-tasks (total 0)', () => {
    render(<IssueRow issue={makeIssue({ subtaskProgress: { done: 0, total: 0 } })} />);
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/sub-tarefas concluídas/)).not.toBeInTheDocument();
  });

  it('renders NO badge when sub-task progress is absent', () => {
    render(<IssueRow issue={makeIssue()} />);
    expect(screen.queryByLabelText(/sub-tarefas concluídas/)).not.toBeInTheDocument();
  });
});
