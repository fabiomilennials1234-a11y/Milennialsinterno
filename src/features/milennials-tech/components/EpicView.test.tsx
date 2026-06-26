import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EpicView } from './EpicView';
import type { EpicHeaderData } from './EpicHeader';
import type { EpicChildIssue } from './EpicIssueRow';
import type { EpicRollup } from '../lib/rollup';

const epic: EpicHeaderData = { id: 'e1', key: 'AGS-EPIC-3', title: 'Checkout reativo' };

const rollup = (over: Partial<EpicRollup> = {}): EpicRollup => ({
  totalPoints: 29,
  donePoints: 18,
  progressPct: 62,
  issueCount: 19,
  doneCount: 12,
  ...over,
});

const child = (over: Partial<EpicChildIssue> = {}): EpicChildIssue => ({
  id: 'i1',
  key: 'AGS-12',
  title: 'Carrinho reativo',
  type: 'STORY',
  status: 'TODO',
  ...over,
});

describe('EpicView', () => {
  it('renders epic identity + rollup tallies', () => {
    render(<EpicView epic={epic} rollup={rollup()} issues={[child()]} />);
    expect(screen.getByText('Checkout reativo')).toBeInTheDocument();
    expect(screen.getByText('AGS-EPIC-3')).toBeInTheDocument();
    expect(screen.getByText('Carrinho reativo')).toBeInTheDocument();
  });

  it('shows the empty state when the epic has no issues', () => {
    render(<EpicView epic={epic} rollup={rollup({ issueCount: 0, doneCount: 0 })} issues={[]} />);
    expect(screen.getByText('Epic ainda sem issues')).toBeInTheDocument();
  });

  it('shows the error state and fires onRetry', () => {
    const onRetry = vi.fn();
    render(
      <EpicView epic={epic} rollup={rollup()} issues={[]} error="boom" onRetry={onRetry} />,
    );
    expect(screen.getByText('Não deu para carregar o epic')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('fires onIssueClick with the issue id', () => {
    const onIssueClick = vi.fn();
    render(<EpicView epic={epic} rollup={rollup()} issues={[child()]} onIssueClick={onIssueClick} />);
    fireEvent.click(screen.getByLabelText('AGS-12 Carrinho reativo'));
    expect(onIssueClick).toHaveBeenCalledWith('i1');
  });

  it('fires onAddIssue from the header action', () => {
    const onAddIssue = vi.fn();
    render(<EpicView epic={epic} rollup={rollup()} issues={[child()]} onAddIssue={onAddIssue} />);
    fireEvent.click(screen.getByText('Issue'));
    expect(onAddIssue).toHaveBeenCalledTimes(1);
  });

  it('renders the skeleton (not the list/error/empty) while loading', () => {
    render(
      <EpicView
        epic={epic}
        rollup={rollup()}
        issues={[child()]}
        loading
        error="ignored-while-loading"
      />,
    );
    // Loading wins over every other state — no title, no error, no row.
    expect(screen.queryByText('Checkout reativo')).not.toBeInTheDocument();
    expect(screen.queryByText('Não deu para carregar o epic')).not.toBeInTheDocument();
    expect(screen.queryByText('Carrinho reativo')).not.toBeInTheDocument();
  });
});
