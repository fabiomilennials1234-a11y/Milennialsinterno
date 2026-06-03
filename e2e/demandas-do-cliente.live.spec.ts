// Slice 4 (#80) — Smoke E2E do VERTICAL SLICE de Demanda, contra DB VIVO.
//
// Como equipe-do-cliente.live.spec.ts: NÃO mocka rede. Usa sessão `authenticated`
// REAL (magic-link via service role -> verifyOtp no browser) e prova que
//   1. `DemandasDoCliente`, montado no modal de cliente, lê demandas reais via a
//      RPC runtime `demanda.do_cliente` no schema `demanda` (PostgREST exposto);
//   2. criar uma demanda bate em `demanda.criar` e reflete na UI.
//
// Não-destrutivo: cria uma demanda de teste com título marcado e a APAGA ao final
// via service role (a tabela demanda.demandas não tem caminho de delete por
// contrato nesta slice; o cleanup usa o service role, fora de RLS). Estado final
// == inicial.
//
// Título marcado [live] — excluído do CI padrão por `--grep-invert "\[live\]"`.
// Rodar: npx playwright test e2e/demandas-do-cliente.live.spec.ts

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

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
const PROJECT_ID = appEnv.VITE_SUPABASE_PROJECT_ID;
const ACCESS_TOKEN = scriptEnv.SUPABASE_ACCESS_TOKEN;

const ADMIN_EMAIL = 'gabrielgipp04@gmail.com';
const CLIENT_NAME = 'Bertin Distribuidora';
const TITULO_TESTE = `__E2E Demanda ${Date.now()}`;

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

// Cleanup das demandas de teste criadas — não-destrutivo (estado final == inicial).
// A escrita direta em demanda.demandas é REVOGADA de authenticated (contrato-only,
// ADR 0004) e não há RPC de delete nesta slice; então o cleanup roda como admin do
// projeto via a Management API SQL (mesmo mecanismo de scripts/sb-sql.sh), fora de RLS.
async function limparDemandasTeste() {
  if (!PROJECT_ID || !ACCESS_TOKEN) return;
  await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: "DELETE FROM demanda.demandas WHERE titulo LIKE '\\_\\_E2E Demanda %';",
    }),
  }).catch(() => {});
}

test.describe('[live] Demandas do cliente — vertical slice contra DB vivo', () => {
  test.skip(!haveCreds, 'Requer .env (anon) + .env.scripts (service role).');

  test.afterAll(async () => {
    await limparDemandasTeste();
  });

  test('renderiza demandas via demanda.do_cliente e criar bate em demanda.criar', async ({
    page,
  }) => {
    const aguardarRpc = (name: 'do_cliente' | 'criar') =>
      page.waitForResponse(
        (r) =>
          new RegExp(`/rest/v1/rpc/${name}(\\?|$)`).test(r.url()) &&
          r.status() >= 200 &&
          r.status() < 300,
        { timeout: 20_000 },
      );

    await logarComSessaoReal(page, await mintEmailOtp());
    await page.goto('/clientes-area');
    await expect(page).toHaveURL(/\/clientes-area$/);

    const row = page.getByText(CLIENT_NAME, { exact: false }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    const listaResp = aguardarRpc('do_cliente');
    await row.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Demandas do cliente' })).toBeVisible({
      timeout: 15_000,
    });
    await listaResp; // prova: leitura veio da RPC demanda.do_cliente via PostgREST.

    const EVID = 'e2e/__evidence__';
    const painel = dialog.locator('section').filter({ hasText: 'Demandas do cliente' }).first();
    await painel.scrollIntoViewIfNeeded();
    await expect(painel).toBeVisible();
    await painel.screenshot({ path: `${EVID}/demandas-do-cliente-vazio.png` });

    // CRIAR — abre o diálogo, preenche, salva -> demanda.criar.
    await dialog.getByRole('button', { name: 'Nova demanda' }).click();
    const criarDialog = page.getByRole('dialog').filter({ hasText: 'Nova demanda' });
    await expect(criarDialog).toBeVisible();
    await criarDialog.getByLabel('Título').fill(TITULO_TESTE);
    await criarDialog.getByLabel(/Domínio/).fill('design');

    // Evidência do diálogo de criação antes de salvar.
    await criarDialog.screenshot({ path: `${EVID}/demandas-criar-dialog.png` });

    const criarResp = aguardarRpc('criar');
    await criarDialog.getByRole('button', { name: 'Criar demanda' }).click();
    await criarResp; // prova: criar bateu em demanda.criar.

    // Reflete na UI: a demanda recém-criada aparece no painel.
    await expect(dialog.getByText(TITULO_TESTE, { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Evidência do painel com a demanda criada (estado preenchido + chips).
    await painel.scrollIntoViewIfNeeded();
    await painel.screenshot({ path: `${EVID}/demandas-do-cliente-painel.png` });
    await page.screenshot({ path: `${EVID}/demandas-do-cliente-live.png`, fullPage: true });
  });
});
