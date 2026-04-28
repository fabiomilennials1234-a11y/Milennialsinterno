// Smoke + integração leve do ClientCallFormSection.
// Cobre: render dos 7 blocos, render do chip-index, handleChange dispara
// com a key correta, divisor "Impor a consultoria" só antes do bloco 7,
// sub-grid expectativas só no bloco 6.

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, within } from '@testing-library/react';
import ClientCallFormSection from '../ClientCallFormSection';

// IntersectionObserver não existe no jsdom — stub mínimo.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
// @ts-expect-error - jsdom global
globalThis.IntersectionObserver = IO;

describe('ClientCallFormSection', () => {
  const baseProps = () => {
    const handleChange = vi.fn();
    const formData = {} as Parameters<typeof ClientCallFormSection>[0]['formData'];
    return { formData, handleChange };
  };

  it('renderiza os 7 blocos com numerais 01..07', () => {
    const { formData, handleChange } = baseProps();
    render(<ClientCallFormSection formData={formData} handleChange={handleChange} />);
    for (const n of ['01', '02', '03', '04', '05', '06', '07']) {
      // Numeral aparece tanto no chip quanto no header — basta existir.
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    }
  });

  it('renderiza chip-index sticky com 7 chips', () => {
    const { formData, handleChange } = baseProps();
    render(<ClientCallFormSection formData={formData} handleChange={handleChange} />);
    const nav = screen.getByRole('navigation', { name: /navegação dos blocos/i });
    const chips = within(nav).getAllByRole('link');
    expect(chips).toHaveLength(7);
    expect(chips[0]).toHaveAttribute('href', '#bloco-1');
    expect(chips[6]).toHaveAttribute('href', '#bloco-7');
  });

  it('handleChange dispara com a key correta ao digitar em campo do bloco 1', () => {
    const { formData, handleChange } = baseProps();
    render(<ClientCallFormSection formData={formData} handleChange={handleChange} />);
    const ticket = screen.getByPlaceholderText(/R\$ 1\.500/i) as HTMLInputElement;
    fireEvent.change(ticket, { target: { value: '999' } });
    expect(handleChange).toHaveBeenCalledWith('ticket_medio', '999');
  });

  it('renderiza sub-grid de expectativas (4 horizontes) — só no bloco 6', () => {
    const { formData, handleChange } = baseProps();
    render(<ClientCallFormSection formData={formData} handleChange={handleChange} />);
    expect(screen.getByText(/Expectativa daqui a/i)).toBeInTheDocument();
    expect(screen.getByText('30 dias')).toBeInTheDocument();
    expect(screen.getByText('3 meses')).toBeInTheDocument();
    expect(screen.getByText('6 meses')).toBeInTheDocument();
    expect(screen.getByText('1 ano')).toBeInTheDocument();
  });

  it('expectativa 30d dispara handleChange com key expectativas_30d', () => {
    const { formData, handleChange } = baseProps();
    render(<ClientCallFormSection formData={formData} handleChange={handleChange} />);
    const tx = screen.getByPlaceholderText(/Expectativas para 30 dias/i);
    fireEvent.change(tx, { target: { value: 'lead novo' } });
    expect(handleChange).toHaveBeenCalledWith('expectativas_30d', 'lead novo');
  });

  it('renderiza divisor "Impor a consultoria com a equipe"', () => {
    const { formData, handleChange } = baseProps();
    render(<ClientCallFormSection formData={formData} handleChange={handleChange} />);
    expect(screen.getByText(/Impor a consultoria com a equipe/i)).toBeInTheDocument();
  });

  it('renderiza lembrete com os 2 itens (apresentar / motivo da call)', () => {
    const { formData, handleChange } = baseProps();
    render(<ClientCallFormSection formData={formData} handleChange={handleChange} />);
    expect(screen.getByText(/Primeiras coisas a fazer na call/i)).toBeInTheDocument();
    expect(screen.getByText('Se apresentar')).toBeInTheDocument();
    expect(screen.getByText('Explicar o motivo da call')).toBeInTheDocument();
  });

  it('persiste valor do formData em campo controlado (input + textarea)', () => {
    const formData = {
      historia_empresa: 'Fundada em 2010',
      ticket_medio: 'R$ 2.500',
    } as Parameters<typeof ClientCallFormSection>[0]['formData'];
    render(<ClientCallFormSection formData={formData} handleChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Fundada em 2010')).toBeInTheDocument();
    expect(screen.getByDisplayValue('R$ 2.500')).toBeInTheDocument();
  });
});
