import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientCombobox } from './client-combobox';

// jsdom não traz ResizeObserver/scrollIntoView que o cmdk usa.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom global
globalThis.ResizeObserver = ResizeObserverStub;
// @ts-expect-error jsdom não implementa
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

// O identificador canônico do cadastro é razao_social (Nome Completo / Razão
// Social, OBRIGATÓRIO). name é "nome fantasia ou apelido". O combobox mostrava
// invertido (fantasia como principal). Empresa deve ser o texto principal.

function openList() {
  fireEvent.click(screen.getByRole('combobox'));
}

describe('ClientCombobox — display do nome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra razao_social como texto principal e name como secundário', () => {
    render(
      <ClientCombobox
        value={null}
        onChange={() => {}}
        clients={[{ id: 'c1', name: 'Jessica', razao_social: 'Grafica Cauta' }]}
      />,
    );
    openList();

    const principal = screen.getByText('Grafica Cauta');
    expect(principal.className).toContain('font-medium');

    const secundario = screen.getByText('Jessica');
    expect(secundario.className).toContain('text-muted-foreground');
  });

  it('fallback: sem razao_social usa name como texto principal', () => {
    render(
      <ClientCombobox
        value={null}
        onChange={() => {}}
        clients={[{ id: 'c2', name: 'Jessica', razao_social: null }]}
      />,
    );
    openList();

    const principal = screen.getByText('Jessica');
    expect(principal.className).toContain('font-medium');
    // razao_social vazio → não renderiza linha secundária duplicada
    expect(principal.className).not.toContain('text-muted-foreground');
  });

  it('razao_social só whitespace cai no fallback para name', () => {
    render(
      <ClientCombobox
        value={null}
        onChange={() => {}}
        clients={[{ id: 'c3', name: 'Jessica', razao_social: '   ' }]}
      />,
    );
    openList();
    const principal = screen.getByText('Jessica');
    expect(principal.className).toContain('font-medium');
  });

  it('razao_social igual a name não renderiza linha secundária duplicada', () => {
    render(
      <ClientCombobox
        value={null}
        onChange={() => {}}
        clients={[{ id: 'c4', name: 'Grafica Cauta', razao_social: 'Grafica Cauta' }]}
      />,
    );
    openList();
    // Apenas UMA ocorrência do texto (principal), sem secundário muted espelhado.
    expect(screen.getAllByText('Grafica Cauta')).toHaveLength(1);
  });

  it('trigger reflete razao_social do cliente selecionado', () => {
    render(
      <ClientCombobox
        value="c1"
        onChange={() => {}}
        clients={[{ id: 'c1', name: 'Jessica', razao_social: 'Grafica Cauta' }]}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Grafica Cauta');
  });

  it('onChange passa o nome canônico (razao_social) como label', () => {
    const onChange = vi.fn();
    render(
      <ClientCombobox
        value={null}
        onChange={onChange}
        clients={[{ id: 'c1', name: 'Jessica', razao_social: 'Grafica Cauta' }]}
      />,
    );
    openList();
    fireEvent.click(screen.getByText('Grafica Cauta'));
    expect(onChange).toHaveBeenCalledWith('c1', 'Grafica Cauta');
  });
});
