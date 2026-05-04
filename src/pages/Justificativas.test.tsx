import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Justificativas from './Justificativas';

vi.mock('@/hooks/useJustificativas', () => ({
  useJustificativasPendentes: () => ({ data: [], isLoading: false }),
  useJustificativasDoneMine: () => ({ data: [], isLoading: false }),
  useJustificativasTeam: () => ({ data: [], isLoading: false }),
  useJustificativasCount: () => ({ data: 0 }),
}));

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Justificativas /></MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Justificativas page', () => {
  it('renderiza tabs Pendentes e Justificadas', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /pendentes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /justificadas/i })).toBeInTheDocument();
  });

  it('Pendentes ativa por default', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /pendentes/i })).toHaveAttribute('data-state', 'active');
  });
});
