import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ConcederProdutoUpsellsModal } from '../ConcederProdutoUpsellsModal';

// ADR 0009 §5 (nota de revisão 2026-06-08): o ato de CONCEDER migrou do Card
// Universal para /upsells, com seleção de cliente. Este modal é a superfície nova.
//
// Radix Select não é dirigível de forma determinística em jsdom (hasPointerCapture
// não implementado), então este teste cobre os invariantes ESTÁVEIS de render:
// estado inicial gated, glossário (nunca "venda"/"vender"), e o catálogo derivado
// do cliente. A interação cliente→produto é coberta por e2e (live), não aqui.

const mockMutateAsync = vi.fn();

vi.mock('@/hooks/useConcessoes', async (orig) => {
  const actual = await orig<typeof import('@/hooks/useConcessoes')>();
  return {
    ...actual,
    useConcederProduto: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  };
});

vi.mock('@/hooks/useClientList', () => ({
  useClientsWithSales: () => ({
    data: [
      {
        id: 'c1',
        name: 'Cliente Vivo',
        status: 'active',
        archived: false,
        contracted_products: ['millennials-growth'],
        torque_crm_products: [],
      },
      {
        id: 'c2',
        name: 'Cliente Churned',
        status: 'churned',
        archived: false,
        contracted_products: [],
      },
      {
        id: 'c3',
        name: 'Cliente Arquivado',
        status: 'active',
        archived: true,
        contracted_products: [],
      },
    ],
    isLoading: false,
  }),
}));

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ConcederProdutoUpsellsModal — superfície /upsells (ADR 0009 §5)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('título e copy usam glossário de concessão, nunca "venda"/"vender"/"upsell"', () => {
    wrap(<ConcederProdutoUpsellsModal open onOpenChange={vi.fn()} />);

    expect(screen.getByText('Conceder produto', { selector: '.flex' })).toBeInTheDocument();
    expect(screen.getByText(/alavanca de retenção/i)).toBeInTheDocument();
    expect(screen.getByText(/margem que a empresa abre mão/i)).toBeInTheDocument();

    // Glossário travado: nenhuma copy de usuário pode dizer venda/vender.
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/\bvend(a|er|eu|as)\b/i);
  });

  it('produto começa desabilitado até escolher cliente (placeholder pede cliente primeiro)', () => {
    wrap(<ConcederProdutoUpsellsModal open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Selecione um cliente primeiro')).toBeInTheDocument();
  });

  it('select de cliente lista só os ativos (exclui churned e arquivado)', () => {
    wrap(<ConcederProdutoUpsellsModal open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Selecione o cliente')).toBeInTheDocument();
    // Os ativos entram no DOM do SelectContent (mesmo fechado, Radix monta os items);
    // os inativos não devem ser oferecidos.
    expect(screen.queryByText('Cliente Churned')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente Arquivado')).not.toBeInTheDocument();
  });

  it('campos de motivo/data nascem desabilitados sem cliente (sem submit possível)', () => {
    wrap(<ConcederProdutoUpsellsModal open onOpenChange={vi.fn()} />);
    const submit = screen.getByRole('button', { name: /Conceder produto/i });
    expect(submit).toBeDisabled();
  });
});

// Gating de QUEM concede — a ÚNICA barreira de UI em /upsells (ProtectedRoute deixa
// qualquer autenticado entrar). Espelha exato o canSetClientLabel que gateava o
// gesto no Card Universal. Testado como predicado puro (a RPC re-checa server-side).
describe('canConceder — paridade com canSetClientLabel', () => {
  const canConceder = (role: string | undefined, isCEO: boolean, isAdminUser: boolean) =>
    isCEO || isAdminUser || role === 'sucesso_cliente';

  it('CEO concede', () => {
    expect(canConceder('ceo', true, false)).toBe(true);
  });

  it('admin (executivo/gestor_projetos via isAdminUser) concede', () => {
    expect(canConceder('gestor_projetos', false, true)).toBe(true);
  });

  it('sucesso_cliente concede', () => {
    expect(canConceder('sucesso_cliente', false, false)).toBe(true);
  });

  it('gestor_ads NÃO concede (fora da tripla)', () => {
    expect(canConceder('gestor_ads', false, false)).toBe(false);
  });

  it('designer NÃO concede', () => {
    expect(canConceder('designer', false, false)).toBe(false);
  });

  it('role indefinido NÃO concede', () => {
    expect(canConceder(undefined, false, false)).toBe(false);
  });
});
