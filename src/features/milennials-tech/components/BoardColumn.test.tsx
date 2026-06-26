import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardColumn } from './BoardColumn';

describe('BoardColumn', () => {
  it('renders without crashing and shows the status label', () => {
    render(<BoardColumn status="TODO" count={0} />);
    expect(screen.getByText('A fazer')).toBeInTheDocument();
  });

  it('honors a label override', () => {
    render(<BoardColumn status="IN_PROGRESS" label="Doing" count={0} />);
    expect(screen.getByText('Doing')).toBeInTheDocument();
    expect(screen.queryByText('Em progresso')).not.toBeInTheDocument();
  });

  it('renders the issue count', () => {
    render(<BoardColumn status="REVIEW" count={4} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders count/limit and flags over-limit', () => {
    render(<BoardColumn status="IN_PROGRESS" count={5} wipLimit={3} />);
    expect(screen.getByText('5/3')).toBeInTheDocument();
    expect(screen.getByTitle('Acima do limite de 3')).toBeInTheDocument();
  });

  it('renders the N child cards in the lane', () => {
    render(
      <BoardColumn status="TODO" count={3}>
        <div>card-a</div>
        <div>card-b</div>
        <div>card-c</div>
      </BoardColumn>,
    );
    expect(screen.getByText('card-a')).toBeInTheDocument();
    expect(screen.getByText('card-b')).toBeInTheDocument();
    expect(screen.getByText('card-c')).toBeInTheDocument();
  });

  it('exposes the column region with an accessible label', () => {
    render(<BoardColumn status="DONE" count={0} />);
    expect(screen.getByRole('region', { name: 'Concluído' })).toBeInTheDocument();
  });
});
