import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Json } from '@/integrations/supabase/types';
import type React from 'react';
import MeetingAtaSection from '../MeetingAtaSection';

function makeAta(overrides: Record<string, unknown> = {}): Json {
  return {
    resumo_executivo: 'Reunião tratou do roadmap do Q3.',
    decisoes: ['Adiar o lançamento do app', 'Contratar mais um designer'],
    proximos_passos: [
      { acao: 'Enviar proposta', responsavel: 'Ana' },
      { acao: 'Revisar contrato', responsavel: null },
    ],
    topicos: [
      { titulo: 'Roadmap', inicio_seg: 30, pontos: ['Prioridades', 'Prazos'] },
      { titulo: 'Orçamento', inicio_seg: 600, pontos: ['Corte de custos'] },
    ],
    modelo: 'claude-sonnet-4-5',
    gerado_em: '2026-06-02T10:00:00Z',
    ...overrides,
  } as Json;
}

const noop = () => {};

function renderSection(props: Partial<React.ComponentProps<typeof MeetingAtaSection>> = {}) {
  return render(
    <MeetingAtaSection
      ataJson={makeAta()}
      transcriptStatus="completed"
      ataStatus="completed"
      onSeek={noop}
      onRetryTranscript={noop}
      onRetryAta={noop}
      {...props}
    />,
  );
}

describe('MeetingAtaSection — render da ata estruturada', () => {
  it('renderiza o resumo executivo', () => {
    renderSection();
    expect(screen.getByText('Reunião tratou do roadmap do Q3.')).toBeInTheDocument();
  });

  it('renderiza cada decisão', () => {
    renderSection();
    expect(screen.getByText('Adiar o lançamento do app')).toBeInTheDocument();
    expect(screen.getByText('Contratar mais um designer')).toBeInTheDocument();
  });

  it('renderiza próximos passos mostrando o responsável quando presente', () => {
    renderSection();
    const passo = screen.getByText('Enviar proposta').closest('li')!;
    expect(within(passo).getByTestId('proximo-passo-responsavel')).toHaveTextContent('Ana');
  });

  it('omite o responsável quando é null', () => {
    renderSection();
    const passo = screen.getByText('Revisar contrato').closest('li')!;
    expect(within(passo).queryByText('null')).not.toBeInTheDocument();
    expect(passo).toHaveTextContent('Revisar contrato');
    expect(within(passo).queryByTestId('proximo-passo-responsavel')).not.toBeInTheDocument();
  });

  it('renderiza tópicos com título, pontos e timestamp formatado', () => {
    renderSection();
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Prioridades')).toBeInTheDocument();
    expect(screen.getByText('00:30')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('dispara onSeek com o segundo do tópico ao clicar no timestamp', async () => {
    const onSeek = vi.fn();
    renderSection({ onSeek });
    await userEvent.click(screen.getByText('10:00'));
    expect(onSeek).toHaveBeenCalledExactlyOnceWith(600);
  });
});

describe('MeetingAtaSection — degradação sem crash', () => {
  it('não crasha quando ata_json é null', () => {
    expect(() => renderSection({ ataJson: null, ataStatus: 'none' })).not.toThrow();
  });

  it('não crasha quando ata_json é malformado (campos faltando / tipos errados)', () => {
    const malformado = { resumo_executivo: 42, decisoes: 'oops', topicos: null } as unknown as Json;
    expect(() => renderSection({ ataJson: malformado, ataStatus: 'completed' })).not.toThrow();
  });

  it('ata totalmente vazia (todos arrays vazios) não renderiza corpo, mas mantém status', () => {
    const vazia = {
      resumo_executivo: '',
      decisoes: [],
      proximos_passos: [],
      topicos: [],
    } as unknown as Json;
    renderSection({ ataJson: vazia, transcriptStatus: 'completed', ataStatus: 'completed' });
    expect(screen.getByTestId('ata-status')).toBeInTheDocument();
    expect(screen.queryByText('Decisões')).not.toBeInTheDocument();
  });

  it('tópico sem pontos renderiza título e timestamp sem crashar', () => {
    const semPontos = {
      resumo_executivo: 'r',
      topicos: [{ titulo: 'Tópico solo', inicio_seg: 5, pontos: [] }],
    } as unknown as Json;
    expect(() => renderSection({ ataJson: semPontos })).not.toThrow();
    expect(screen.getByText('Tópico solo')).toBeInTheDocument();
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });

  it('renderiza os campos válidos de uma ata parcialmente malformada', () => {
    const parcial = {
      resumo_executivo: 'Resumo ok',
      decisoes: ['Decisão válida', 123, null],
      proximos_passos: 'não é array',
      topicos: [{ titulo: 'Tópico ok', inicio_seg: 90, pontos: ['ponto ok'] }],
    } as unknown as Json;
    renderSection({ ataJson: parcial });
    expect(screen.getByText('Resumo ok')).toBeInTheDocument();
    expect(screen.getByText('Decisão válida')).toBeInTheDocument();
    expect(screen.getByText('Tópico ok')).toBeInTheDocument();
    expect(screen.getByText('01:30')).toBeInTheDocument();
  });
});

describe('MeetingAtaSection — status visível', () => {
  it('mostra status de transcrição e de ata em processamento', () => {
    renderSection({ ataJson: null, transcriptStatus: 'processing', ataStatus: 'pending' });
    expect(screen.getByTestId('transcript-status')).toHaveTextContent(/processando/i);
    expect(screen.getByTestId('ata-status')).toHaveTextContent(/pendente/i);
  });

  it('mostra status concluído e falhou', () => {
    renderSection({ ataJson: null, transcriptStatus: 'completed', ataStatus: 'failed' });
    expect(screen.getByTestId('transcript-status')).toHaveTextContent(/conclu/i);
    expect(screen.getByTestId('ata-status')).toHaveTextContent(/falhou/i);
  });
});

describe('MeetingAtaSection — botão tentar de novo', () => {
  it('não mostra retry quando nada falhou', () => {
    renderSection({ transcriptStatus: 'completed', ataStatus: 'completed' });
    expect(screen.queryByRole('button', { name: /tentar de novo/i })).not.toBeInTheDocument();
  });

  it('não mostra retry enquanto está processando', () => {
    renderSection({ ataJson: null, transcriptStatus: 'processing', ataStatus: 'pending' });
    expect(screen.queryByRole('button', { name: /tentar de novo/i })).not.toBeInTheDocument();
  });

  it('mostra retry de transcrição apenas quando a transcrição falhou e dispara o callback certo', async () => {
    const onRetryTranscript = vi.fn();
    const onRetryAta = vi.fn();
    renderSection({
      ataJson: null,
      transcriptStatus: 'failed',
      ataStatus: 'none',
      onRetryTranscript,
      onRetryAta,
    });
    const btn = screen.getByTestId('retry-transcript');
    expect(btn).toHaveTextContent(/tentar de novo/i);
    expect(screen.queryByTestId('retry-ata')).not.toBeInTheDocument();
    await userEvent.click(btn);
    expect(onRetryTranscript).toHaveBeenCalledOnce();
    expect(onRetryAta).not.toHaveBeenCalled();
  });

  it('mostra retry de ata apenas quando a ata falhou e dispara o callback certo', async () => {
    const onRetryTranscript = vi.fn();
    const onRetryAta = vi.fn();
    renderSection({
      ataJson: null,
      transcriptStatus: 'completed',
      ataStatus: 'failed',
      onRetryTranscript,
      onRetryAta,
    });
    const btn = screen.getByTestId('retry-ata');
    expect(btn).toHaveTextContent(/tentar de novo/i);
    expect(screen.queryByTestId('retry-transcript')).not.toBeInTheDocument();
    await userEvent.click(btn);
    expect(onRetryAta).toHaveBeenCalledOnce();
    expect(onRetryTranscript).not.toHaveBeenCalled();
  });
});
