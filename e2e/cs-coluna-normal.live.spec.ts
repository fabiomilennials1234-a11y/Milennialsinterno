// #23 (brief regra-zero) — Evidência da coluna "Clientes Normais"
// (cs_classification='normal') no kanban do Sucesso do Cliente, contra DB VIVO.
//
// Backend já tinha o enum `normal` e ~107 clientes; a UI nunca renderizava a
// coluna. Esta spec prova que a coluna agora aparece, populada, no kanban CS.
//
// Sessão real sem senha em claro: service role gera magic-link; o email_otp é
// trocado por sessão `authenticated` legítima no browser (verifyOtp). RLS de
// public.clients exercida de verdade — admin (CTO) vê toda a carteira.
//
// Não-destrutivo: apenas LÊ o kanban e captura screenshot. Zero mutação.
// Título [live] — excluído do CI padrão.
// Rodar: npx playwright test e2e/cs-coluna-normal.live.spec.ts

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

// Admin (CTO) — is_admin: vê toda a carteira via RLS.
const ADMIN_EMAIL = 'gabrielgipp04@gmail.com';

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

test.describe('[live] CS — coluna Clientes Normais no kanban', () => {
  test.skip(!haveCreds, 'Requer .env (anon) + .env.scripts (service role).');

  test('coluna "Clientes Normais" aparece populada no kanban Sucesso do Cliente', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await logarComSessaoReal(page, await mintEmailOtp());

    // O popup obrigatório de "PAPO DE CX" (CXValidationPopup) abre sempre que há
    // cliente aguardando validação e só fecha com mutação (Sim/Não). Como esta
    // spec é NÃO-destrutiva e o popup é alheio à mudança da coluna `normal`,
    // neutralizamos APENAS a query de pendências CX no nível de rede (read-only,
    // sem tocar app nem DB), retornando lista vazia. A lista de clientes do CS
    // usa outro select e permanece intacta — a coluna `normal` segue real.
    await page.route(
      (url) =>
        url.pathname.endsWith('/rest/v1/clients') &&
        url.search.includes('cx_validation_status=in.'),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        }),
    );

    await page.goto('/sucesso-cliente', { waitUntil: 'networkidle' });

    // Página é pesada (muitas queries); dá folga ao hydrate do kanban.
    // O título da página vive num h1 dentro de <main>.
    await expect(
      page.locator('main h1', { hasText: 'Sucesso do Cliente' }),
    ).toBeVisible({ timeout: 90_000 });

    // Header da coluna Normais — config já existente em CSClassificationColumn.
    const header = page.locator('h2', { hasText: 'Clientes Normais' });
    await expect(header).toBeAttached({ timeout: 90_000 });

    // Traz a coluna para o viewport (kanban é scroll horizontal).
    await header.scrollIntoViewIfNeeded();
    await expect(header).toBeVisible({ timeout: 15_000 });

    // A coluna é a raiz flex-shrink-0 que contém o header.
    const column = page.locator('div.flex-shrink-0', { has: header }).first();

    // Cards de cliente: cada um tem um h4 com o nome (carteira tem ~107 normais).
    const cards = column.locator('h4');
    await expect
      .poll(async () => await cards.count(), { timeout: 30_000 })
      .toBeGreaterThan(0);

    // Evidência: coluna em foco.
    await column.screenshot({
      path: 'e2e/__evidence__/cs-coluna-normal-coluna.png',
    });

    // Evidência: kanban inteiro.
    await page.screenshot({
      path: 'e2e/__evidence__/cs-coluna-normal-kanban.png',
      fullPage: false,
    });
  });
});
