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

describe('IssueRow — epic chip (#170)', () => {
  it('shows the epic chip in flat mode (showEpicChip)', () => {
    render(
      <IssueRow issue={makeIssue({ epicId: 'e1', epicKey: 'CHK-E1' })} showEpicChip />,
    );
    expect(screen.getByText('CHK-E1')).toBeInTheDocument();
  });

  it('hides the epic chip when grouped (rail + header carry identity)', () => {
    render(
      <IssueRow issue={makeIssue({ epicId: 'e1', epicKey: 'CHK-E1' })} showEpicChip={false} />,
    );
    expect(screen.queryByText('CHK-E1')).not.toBeInTheDocument();
  });

  it('shows no chip when the issue has no epic, even in flat mode', () => {
    render(<IssueRow issue={makeIssue({ epicId: null, epicKey: null })} showEpicChip />);
    expect(screen.queryByLabelText(/^Epic:/)).not.toBeInTheDocument();
  });
});
