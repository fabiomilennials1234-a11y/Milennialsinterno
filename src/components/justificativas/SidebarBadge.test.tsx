import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SidebarBadge from './SidebarBadge';

vi.mock('@/hooks/useJustificativas', () => ({
  useJustificativasCount: vi.fn(),
}));

// Role outside CHURN_BADGE_ROLES so churn count stays 0 and badge value
// equals the justificativas count under test.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'gestor_projetos' } }),
}));

vi.mock('@/hooks/useChurnNotifications', () => ({
  useChurnNotifications: () => ({ data: [] }),
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
