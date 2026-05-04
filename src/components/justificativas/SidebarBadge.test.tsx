import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SidebarBadge from './SidebarBadge';

vi.mock('@/hooks/useJustificativas', () => ({
  useJustificativasCount: vi.fn(),
}));

import { useJustificativasCount } from '@/hooks/useJustificativas';

describe('SidebarBadge', () => {
  it('oculta quando count = 0', () => {
    (useJustificativasCount as any).mockReturnValue({ data: 0, isLoading: false });
    const { container } = render(<MemoryRouter><SidebarBadge /></MemoryRouter>);
    expect(container.firstChild).toBeNull();
  });

  it('mostra quando count > 0', () => {
    (useJustificativasCount as any).mockReturnValue({ data: 3, isLoading: false });
    render(<MemoryRouter><SidebarBadge /></MemoryRouter>);
    expect(screen.getByText('Justificativas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('aponta para /justificativas', () => {
    (useJustificativasCount as any).mockReturnValue({ data: 1, isLoading: false });
    render(<MemoryRouter><SidebarBadge /></MemoryRouter>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/justificativas');
  });
});
