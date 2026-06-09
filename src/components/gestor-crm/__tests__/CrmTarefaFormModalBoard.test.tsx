import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import CrmTarefaFormModal from '../CrmTarefaFormModal';
import type { TorqueCrmClient } from '@/hooks/useTorqueCrmClients';

// jsdom não traz ResizeObserver/scrollIntoView que o cmdk (ClientCombobox) e o
// Radix Select usam. Polyfill local — não suja o setup global.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom global
globalThis.ResizeObserver = ResizeObserverStub;
// @ts-expect-error jsdom não implementa
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
// @ts-expect-error Radix Select usa hasPointerCapture/releasePointerCapture
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
// @ts-expect-error idem
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

// Botão "Brifar tarefa" — modo board do CrmTarefaFormModal. Abre SEM cliente;
// o combobox lista só clientes Torque CRM; escolher um cliente DERIVA produtos
// + gestor do próprio cliente; cliente sem gestor mostra seletor inline; o
// submit chama a RPC (gerarCardBoard via useCreateCrmConfiguracoes) com o gestor
// RESOLVIDO. Zero mudança de DB/RLS — o teste cobre a resolução no front.

// ---- mocks de dados (cada hook é a fronteira de I/O do modal) ----
const COM_GESTOR: TorqueCrmClient = {
  id: 'cli-com',
  name: 'Cliente Com Gestor',
  razao_social: null,
  produtos: ['automation', 'torque'],
  assigned_crm: 'gestor-1',
};
const SEM_GESTOR: TorqueCrmClient = {
  id: 'cli-sem',
  name: 'Cliente Sem Gestor',
  razao_social: null,
  produtos: ['torque'],
  assigned_crm: null,
};

const GESTORES = [
  { user_id: 'gestor-1', name: 'Ana Gestora' },
  { user_id: 'gestor-2', name: 'Bruno Gestor' },
];

const mutateAsync = vi.fn().mockResolvedValue([]);

vi.mock('@/hooks/useTorqueCrmClients', () => ({
  useTorqueCrmClients: () => ({ data: [COM_GESTOR, SEM_GESTOR], isLoading: false }),
}));
vi.mock('@/hooks/useCrmGestors', () => ({
  useCrmGestors: () => ({ data: GESTORES }),
}));
vi.mock('@/hooks/useAllActiveClients', () => ({
  useAllActiveClients: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/useCrmKanban', async (orig) => {
  const actual = await orig<typeof import('@/hooks/useCrmKanban')>();
  return {
    ...actual,
    useCreateCrmConfiguracoes: () => ({ mutateAsync, isPending: false }),
  };
});

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function openModal() {
  return wrap(<CrmTarefaFormModal mode="board" isOpen onClose={() => {}} />);
}

/** Seleciona um cliente no ClientCombobox (popover + command item). */
async function pickClient(name: string) {
  fireEvent.click(screen.getByRole('combobox'));
  const option = await screen.findByText(name);
  fireEvent.click(option);
}

describe('CrmTarefaFormModal — modo board', () => {
  beforeEach(() => vi.clearAllMocks());

  it('abre SEM cliente: título genérico e prompt para escolher cliente', () => {
    openModal();
    // título do dialog (não confundir com o botão de submit homônimo)
    expect(screen.getByRole('heading', { name: 'Brifar tarefa' })).toBeInTheDocument();
    expect(
      screen.getByText(/Escolha um cliente com Torque CRM/i),
    ).toBeInTheDocument();
    // sem cliente => sem bloco de produtos ainda
    expect(screen.queryByText('Produto a configurar')).not.toBeInTheDocument();
  });

  it('combobox só anuncia clientes Torque CRM e o vazio nomeia a causa', () => {
    openModal();
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText('Cliente Com Gestor')).toBeInTheDocument();
    expect(screen.getByText('Cliente Sem Gestor')).toBeInTheDocument();
  });

  it('escolher cliente Torque CRM popula os produtos derivados (mais alto)', async () => {
    openModal();
    await pickClient('Cliente Com Gestor');
    // bloco de produto aparece; Automation (mais alto) é o configurado
    expect(await screen.findByText('Produto a configurar')).toBeInTheDocument();
    expect(
      screen.getByText(/Apenas/).textContent,
    ).toMatch(/Automation/);
  });

  it('cliente COM gestor: mostra o gestor resolvido (read-only), sem seletor', async () => {
    openModal();
    await pickClient('Cliente Com Gestor');
    expect(await screen.findByText(/Gestor de CRM:/)).toBeInTheDocument();
    expect(screen.getByText('Ana Gestora')).toBeInTheDocument();
    // sem seletor inline
    expect(screen.queryByText('Selecionar gestor…')).not.toBeInTheDocument();
  });

  it('cliente SEM gestor: mostra seletor inline e microcopy de atribuição', async () => {
    openModal();
    await pickClient('Cliente Sem Gestor');
    expect(await screen.findByText(/Gestor de CRM \*/)).toBeInTheDocument();
    expect(screen.getByText('Selecionar gestor…')).toBeInTheDocument();
    expect(
      screen.getByText(/será atribuído ao brifar/i),
    ).toBeInTheDocument();
  });

  it('cliente SEM gestor: submit travado até escolher gestor', async () => {
    openModal();
    await pickClient('Cliente Sem Gestor');
    // escolhe funil para isolar a trava no gestor
    fireEvent.click(await screen.findByRole('button', { name: /Funil A/ }));
    const submit = screen.getByRole('button', { name: /Brifar tarefa/ });
    expect(submit).toBeDisabled();
  });

  it('cliente COM gestor: brifar chama a RPC com o gestor resolvido', async () => {
    openModal();
    await pickClient('Cliente Com Gestor');
    fireEvent.click(await screen.findByRole('button', { name: /Funil A/ }));
    const submit = screen.getByRole('button', { name: /Brifar tarefa/ });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.clientId).toBe('cli-com');
    expect(arg.gestorId).toBe('gestor-1');
    expect(arg.produtos).toEqual(['automation']);
    expect(arg.funil).toBe('A');
  });

  it('cliente SEM gestor: brifar usa o gestor escolhido inline', async () => {
    openModal();
    await pickClient('Cliente Sem Gestor');
    fireEvent.click(await screen.findByRole('button', { name: /Funil B/ }));

    // abre o Select de gestor e escolhe Bruno
    fireEvent.click(screen.getByText('Selecionar gestor…'));
    const opt = await screen.findByRole('option', { name: 'Bruno Gestor' });
    fireEvent.click(opt);

    const submit = screen.getByRole('button', { name: /Brifar tarefa/ });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.clientId).toBe('cli-sem');
    expect(arg.gestorId).toBe('gestor-2');
    expect(arg.produtos).toEqual(['torque']);
    expect(arg.funil).toBe('B');
  });
});
