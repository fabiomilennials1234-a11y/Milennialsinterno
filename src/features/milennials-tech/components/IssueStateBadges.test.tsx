import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IssueStateBadges } from './IssueStateBadges';

describe('IssueStateBadges', () => {
  it('renders nothing in the clean state', () => {
    const { container } = render(<IssueStateBadges />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the BLOCKED badge when blocked', () => {
    render(<IssueStateBadges isBlocked />);
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
  });

  it('shows the CHANGES_REQUESTED badge when changes requested', () => {
    render(<IssueStateBadges changesRequested />);
    expect(screen.getByText('Alterações')).toBeInTheDocument();
  });

  it('shows the AWAITING_APPROVAL badge when awaiting approval', () => {
    render(<IssueStateBadges awaitingApproval />);
    expect(screen.getByText('Aprovação')).toBeInTheDocument();
  });

  it('stacks every active state together', () => {
    render(<IssueStateBadges isBlocked changesRequested awaitingApproval />);
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
    expect(screen.getByText('Alterações')).toBeInTheDocument();
    expect(screen.getByText('Aprovação')).toBeInTheDocument();
  });

  it('surfaces the blocker reason inline on the issue-view', () => {
    render(
      <IssueStateBadges isBlocked blockerReason="aguardando design" reason="inline" size="md" />,
    );
    expect(screen.getByText(/aguardando design/)).toBeInTheDocument();
  });
});
