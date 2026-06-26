import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtaskSection, type SubtaskItem } from './SubtaskSection';

const sub = (over: Partial<SubtaskItem> = {}): SubtaskItem => ({
  id: 's1',
  key: 'AGS-42',
  title: 'Validar payload',
  status: 'TODO',
  ...over,
});

describe('SubtaskSection', () => {
  it('renders the done/total progress in the header', () => {
    render(
      <SubtaskSection
        subtasks={[sub({ id: 'a', status: 'DONE' }), sub({ id: 'b', status: 'TODO' })]}
        assignees={[]}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('opens the composer and creates a sub-task with the trimmed title', () => {
    const onCreate = vi.fn();
    render(<SubtaskSection subtasks={[]} assignees={[]} onCreate={onCreate} />);

    fireEvent.click(screen.getByText('Adicionar sub-tarefa'));
    fireEvent.change(screen.getByLabelText('Título da sub-tarefa'), {
      target: { value: '  Escrever testes  ' },
    });
    fireEvent.click(screen.getByText('Criar'));

    expect(onCreate).toHaveBeenCalledWith({ title: 'Escrever testes', assigneeId: null });
  });

  it('keeps the create button disabled until the title is valid', () => {
    render(<SubtaskSection subtasks={[]} assignees={[]} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByText('Adicionar sub-tarefa'));
    const create = screen.getByText('Criar');
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Título da sub-tarefa'), { target: { value: 'a' } });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Título da sub-tarefa'), { target: { value: 'ab' } });
    expect(create).not.toBeDisabled();
  });

  it('surfaces an inline server error', () => {
    render(
      <SubtaskSection subtasks={[]} assignees={[]} onCreate={vi.fn()} error="Sem permissão" />,
    );
    fireEvent.click(screen.getByText('Adicionar sub-tarefa'));
    expect(screen.getByText('Sem permissão')).toBeInTheDocument();
  });

  it('hides the composer in read-only mode', () => {
    render(<SubtaskSection subtasks={[sub()]} assignees={[]} onCreate={vi.fn()} readOnly />);
    expect(screen.queryByText('Adicionar sub-tarefa')).not.toBeInTheDocument();
  });

  it('cancels the composer on Escape without calling onCreate', () => {
    const onCreate = vi.fn();
    render(<SubtaskSection subtasks={[]} assignees={[]} onCreate={onCreate} />);
    fireEvent.click(screen.getByText('Adicionar sub-tarefa'));
    const input = screen.getByLabelText('Título da sub-tarefa');
    fireEvent.change(input, { target: { value: 'descartar' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText('Título da sub-tarefa')).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
