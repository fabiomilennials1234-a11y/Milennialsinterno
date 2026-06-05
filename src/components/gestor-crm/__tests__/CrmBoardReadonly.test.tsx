import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EditableChecklist, ApresentacaoCard } from '../CrmBoardKanban';
import type { ChecklistItem } from '@/lib/torqueCrm/checklist';

// Slice 3 (#138) — board CRM read-only pro gestor_ads. PRD #135, ADR 0006.
// Os subcomponentes de interação aceitam `readonly`. No modo readonly, o
// CONTEÚDO (itens do checklist, data da apresentação) permanece VISÍVEL (é o que
// o ads acompanha), mas os CONTROLES de operação não renderizam. As RPCs já
// barram quem não é gestor do card (defesa em profundidade) — isto é a camada UX.

// Mock dos hooks de mutação: o teste readonly nem deve dispará-los, mas o módulo
// os importa no caminho editável. Mantém o render puro e determinístico.
vi.mock('@/hooks/useCrmKanban', async (orig) => {
  const actual = await orig<typeof import('@/hooks/useCrmKanban')>();
  const stub = () => ({ mutate: vi.fn(), isPending: false });
  return {
    ...actual,
    useSetChecklist: stub,
    useAgendarApresentacao: stub,
    useMarcarPronto: stub,
    useComecarCard: stub,
  };
});

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const CHECKLIST: ChecklistItem[] = [
  { id: '1', label: 'Receber briefing', done: true },
  { id: '2', label: 'Configurar pipeline', done: false },
];

describe('Slice 3 (#138) — EditableChecklist readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  it('readonly: mostra os itens do checklist (conteúdo visível)', () => {
    wrap(<EditableChecklist configId="c1" checklist={CHECKLIST} readonly />);
    expect(screen.getByText('Receber briefing')).toBeInTheDocument();
    expect(screen.getByText('Configurar pipeline')).toBeInTheDocument();
  });

  it('readonly: NÃO renderiza "Adicionar item" (sem controle de criação)', () => {
    wrap(<EditableChecklist configId="c1" checklist={CHECKLIST} readonly />);
    expect(screen.queryByText('Adicionar item')).not.toBeInTheDocument();
  });

  it('readonly: itens não são botões de toggle (sem aria-pressed togglável)', () => {
    wrap(<EditableChecklist configId="c1" checklist={CHECKLIST} readonly />);
    expect(screen.queryByLabelText(/^Marcar /)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Desmarcar /)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Remover /)).not.toBeInTheDocument();
  });

  it('manage (default): renderiza o controle "Adicionar item"', () => {
    wrap(<EditableChecklist configId="c1" checklist={CHECKLIST} />);
    expect(screen.getByText('Adicionar item')).toBeInTheDocument();
  });
});

describe('Slice 3 (#138) — ApresentacaoCard readonly', () => {
  beforeEach(() => vi.clearAllMocks());

  const FUTURE = '2099-12-31T15:00:00.000Z';

  it('readonly: mostra a data marcada (conteúdo visível)', () => {
    wrap(<ApresentacaoCard configId="c1" apresentacaoAt={FUTURE} readonly />);
    // a data é formatada pt-BR; basta haver algum texto de data/hora
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
  });

  it('readonly: NÃO renderiza controles de operação (Salvar/Pronto/Reagendar/Alterar)', () => {
    wrap(<ApresentacaoCard configId="c1" apresentacaoAt={FUTURE} readonly />);
    expect(screen.queryByText('Salvar data')).not.toBeInTheDocument();
    expect(screen.queryByText('Pronto')).not.toBeInTheDocument();
    expect(screen.queryByText('Reagendar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Alterar data/)).not.toBeInTheDocument();
  });
});
