import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichTextWithLinks, BriefingField } from '../BriefingField';

describe('BriefingField', () => {
  it('mostra "Não informado" quando valor é null', () => {
    render(<BriefingField label="Materiais" value={null} isLink />);

    expect(screen.getByText('Não informado')).toBeInTheDocument();
    expect(screen.getByText('Materiais')).toBeInTheDocument();
  });

  it('renderiza URL pura como link único quando isLink=true', () => {
    render(<BriefingField label="Materiais" value="https://drive.google.com/folder/abc" isLink />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://drive.google.com/folder/abc');
  });

  it('renderiza texto misto com links individuais quando isLink=true', () => {
    render(
      <BriefingField
        label="Materiais"
        value="FOTOS BARRAS : https://drive.google.com/folder/abc ver também https://example.com"
        isLink
      />
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://drive.google.com/folder/abc');
    expect(links[1]).toHaveAttribute('href', 'https://example.com');
  });

  it('renderiza texto com whitespace preservado quando isText=true', () => {
    const { container } = render(
      <BriefingField label="Observações" value={"Linha 1\nLinha 2"} isText />
    );

    const textEl = container.querySelector('.whitespace-pre-wrap');
    expect(textEl).toBeTruthy();
    expect(textEl!.textContent).toContain('Linha 1');
    expect(textEl!.textContent).toContain('Linha 2');
  });
});

describe('RichTextWithLinks', () => {
  it('renderiza texto puro sem URLs como span simples', () => {
    render(<RichTextWithLinks text="FOTOS BARRAS materiais do cliente" />);

    expect(screen.getByText('FOTOS BARRAS materiais do cliente')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renderiza URL pura como link clicável', () => {
    render(<RichTextWithLinks text="https://drive.google.com/folder/abc123" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://drive.google.com/folder/abc123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renderiza texto misto com URL: texto como span, URL como link', () => {
    const { container } = render(
      <RichTextWithLinks text="FOTOS BARRAS : https://drive.google.com/folder/abc123 mais info aqui" />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://drive.google.com/folder/abc123');

    const fullText = container.textContent!;
    expect(fullText).toContain('FOTOS BARRAS');
    expect(fullText).toContain('mais info aqui');
  });

  it('renderiza múltiplas URLs como links independentes', () => {
    render(
      <RichTextWithLinks text="Fotos: https://drive.google.com/folder/1 Videos: https://youtube.com/watch?v=abc" />
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://drive.google.com/folder/1');
    expect(links[1]).toHaveAttribute('href', 'https://youtube.com/watch?v=abc');
  });
});
