import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JustificarForm from './JustificarForm';

const submitMock = vi.fn();
vi.mock('@/hooks/useJustificativas', () => ({
  useSubmitJustificativa: () => ({ mutateAsync: submitMock, isPending: false }),
}));

describe('JustificarForm', () => {
  it('envia texto trimmed via mutation', async () => {
    submitMock.mockResolvedValue('id-1');
    render(<JustificarForm notificationId="n1" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  meu motivo  ' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(submitMock).toHaveBeenCalledWith({ notificationId: 'n1', text: '  meu motivo  ' });
  });

  it('botão desabilitado com texto vazio', () => {
    render(<JustificarForm notificationId="n1" />);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });
});
