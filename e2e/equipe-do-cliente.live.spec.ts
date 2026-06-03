// Slice 2 (#78) — Smoke E2E do VERTICAL SLICE de Envolvido, contra DB VIVO.
//
// Diferente de smoke.spec.ts (mock total de /rest/v1/**), este spec NÃO mocka
// rede: usa uma sessão `authenticated` REAL e prova que
//   1. `EquipeDoCliente`, montado no modal de cliente, renderiza Envolvidos
//      reais vindos de `cliente.client_members` via PostgREST (schema `cliente`);
//   2. adicionar/remover Envolvido bate nas RPCs runtime
//      `cliente.adicionar_membro` / `cliente.remover_membro` e reflete na UI.
//
// Sessão real sem senha em claro: o service role (de .env.scripts) gera um
// magic-link via admin/generate_link; o `email_otp` é trocado por uma sessão
// real no browser (supabase.auth.verifyOtp) — JWT `authenticated` legítimo, com
// a RLS de `public.clients` e o predicado das RPCs exercidos de verdade.
//
// Não-destrutivo: adiciona/remove o PRÓPRIO admin como `secondary_manager` do
// cliente-alvo (papel que NÃO espelha em assigned_*; ver ADR 0005 §4). Estado
// final == inicial.
//
// Título marcado [live] — excluído do CI padrão por `--grep-invert "\[live\]"`.
// Rodar: npx playwright test e2e/equipe-do-cliente.live.spec.ts

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// --- env (sem hardcode de segredo) -----------------------------------------
function readEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = '';
  try {
    raw = readFileSync(resolve(process.cwd(), file), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const appEnv = { ...readEnv('.env'), ...readEnv('.env.local') };
const scriptEnv = readEnv('.env.scripts');

const SUPABASE_URL = appEnv.VITE_SUPABASE_URL;
const ANON_KEY = appEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE = scriptEnv.SUPABASE_SERVICE_ROLE_KEY;

// Admin (CTO) — is_admin: vê todo cliente via caminho (A) da RLS, e é envolvível.
const ADMIN_EMAIL = 'gabrielgipp04@gmail.com';
// Cliente com 5 Envolvidos reais (tela rica, determinística).
const CLIENT_NAME = 'Bertin Distribuidora';
const MEMBROS_REAIS = ['Augusto Klein', 'Diego', 'Gustavo Lima', 'maria rosa', 'Maycon'];

const haveCreds = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE);

async function mintEmailOtp(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email: ADMIN_EMAIL }),
  });
  if (!res.ok) throw new Error(`generate_link: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { email_otp?: string };
  if (!body.email_otp) throw new Error('generate_link sem email_otp');
  return body.email_otp;
}

// Troca o OTP por uma sessão real DENTRO do browser e grava em localStorage no
// formato que o app lê (storageKey 'mgrowth-auth'). Sem mock de rede.
async function logarComSessaoReal(page: Page, otp: string) {
  await page.goto('/login');
  const result = await page.evaluate(
    async ({ url, anon, email, token }) => {
      const mod = await import('https://esm.sh/@supabase/supabase-js@2');
      const client = (
        mod as { createClient: (u: string, k: string, o: unknown) => unknown }
      ).createClient(url, anon, {
        auth: { storageKey: 'mgrowth-auth', persistSession: true },
      }) as {
        auth: {
          verifyOtp: (a: unknown) => Promise<{
            data: { session: unknown | null };
            error: { message: string } | null;
          }>;
        };
      };
      const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
      return { ok: !error && !!data.session, error: error?.message ?? null };
    },
    { url: SUPABASE_URL, anon: ANON_KEY, email: ADMIN_EMAIL, token: otp },
  );
  expect(result.ok, `verifyOtp deveria criar sessão real: ${result.error}`).toBeTruthy();
}

test.describe('[live] Equipe do cliente — vertical slice contra DB vivo', () => {
  test.skip(!haveCreds, 'Requer .env (anon) + .env.scripts (service role).');

  test('renderiza Envolvidos reais e add/remove bate na RPC do schema cliente', async ({
    page,
  }) => {
    // Espera ativa por uma resposta de RPC do schema `cliente` (status 2xx).
    // Mais robusto que coletar passivamente: ancora a asserção no evento real.
    const aguardarRpc = (name: 'membros' | 'adicionar_membro' | 'remover_membro') =>
      page.waitForResponse(
        (r) =>
          new RegExp(`/rest/v1/rpc/${name}(\\?|$)`).test(r.url()) &&
          r.status() >= 200 &&
          r.status() < 300,
        { timeout: 20_000 },
      );

    // 1) Sessão real e área de clientes (AdminRoute — admin passa).
    await logarComSessaoReal(page, await mintEmailOtp());
    await page.goto('/clientes-area');
    await expect(page).toHaveURL(/\/clientes-area$/);

    // 2) Abre o cliente-alvo — a leitura dispara a RPC `membros`.
    const row = page.getByText(CLIENT_NAME, { exact: false }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    const membrosResp = aguardarRpc('membros');
    await row.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Equipe do cliente' })).toBeVisible({
      timeout: 15_000,
    });
    await membrosResp; // prova: leitura veio da RPC cliente.membros via PostgREST.

    // 3) Dados REAIS — os 5 Envolvidos atuais do cliente aparecem por nome.
    for (const nome of MEMBROS_REAIS) {
      await expect(dialog.getByText(nome, { exact: false }).first()).toBeVisible({
        timeout: 15_000,
      });
    }

    // Screenshot focado no painel real montado, com dados reais.
    const painel = dialog.locator('section').filter({ hasText: 'Equipe do cliente' }).first();
    await painel.scrollIntoViewIfNeeded();
    await painel.screenshot({ path: 'test-results/equipe-do-cliente-painel.png' });
    await page.screenshot({ path: 'test-results/equipe-do-cliente-live.png', fullPage: true });

    // 4) ADD — admin como Gestor Secundário (não espelha assigned_*; reversível).
    await dialog.getByRole('button', { name: 'Adicionar' }).click();
    const addDialog = page.getByRole('dialog').filter({ hasText: 'Adicionar à equipe' });
    await expect(addDialog).toBeVisible();

    await addDialog.getByRole('combobox', { name: 'Selecionar pessoa' }).click();
    await page.getByPlaceholder('Buscar por nome…').fill('Gabriel');
    await page.getByRole('option', { name: /Gabriel/i }).first().click();

    await addDialog.getByLabel('Selecionar papel').click();
    await page.getByRole('option', { name: 'Gestor Secundário' }).click();

    const addResp = aguardarRpc('adicionar_membro');
    await addDialog.getByRole('button', { name: 'Adicionar' }).click();
    await addResp; // prova: add bateu em cliente.adicionar_membro.

    // Reflete na UI: chip "Gestor Secundário" presente no painel.
    await expect(
      dialog.getByText('Gestor Secundário', { exact: false }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // 5) REMOVE — desfaz, restaurando o estado inicial.
    const removeResp = aguardarRpc('remover_membro');
    await dialog
      .getByRole('button', { name: /Remover papel Gestor Secundário/i })
      .first()
      .click();
    await page.getByRole('button', { name: 'Remover', exact: true }).click();
    await removeResp; // prova: remove bateu em cliente.remover_membro.
  });
});
