import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import JustificativaItem from './JustificativaItem';

describe('JustificativaItem', () => {
  const baseProps = {
    title: 'Tarefa X',
    dueDate: '2026-05-01T00:00:00Z',
    state: 'pending' as const,
  };

  it('renderiza pendente com título e prazo', () => {
    render(<JustificativaItem {...baseProps} />);
    expect(screen.getByText('Tarefa X')).toBeInTheDocument();
  });

  it('renderiza banner de revisão quando state=revision', () => {
    render(<JustificativaItem {...baseProps} state="revision" masterComment="refaça" />);
    expect(screen.getByText(/refaça/i)).toBeInTheDocument();
  });

  it('renderiza texto de justificativa quando state=done', () => {
    render(<JustificativaItem {...baseProps} state="done" justificationText="motivo claro" />);
    expect(screen.getByText('motivo claro')).toBeInTheDocument();
  });
});
