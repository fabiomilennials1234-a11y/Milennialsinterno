// Slice 3 (#79) — Smoke E2E do modo EDIÇÃO do Card Universal, contra DB VIVO.
//
// Irmão de equipe-do-cliente.live.spec.ts: usa sessão `authenticated` REAL
// (magic-link → verifyOtp no browser), abre o modal de cliente e prova que o
// painel `CardUniversalCliente` entra em MODO EDIÇÃO in-place (progressive
// disclosure) com a linguagem material `mtech`. Evidência visual durável em
// e2e/__evidence__/ para a auditoria de design (hm-design).
//
// Não-destrutivo: ENTRA em edição, captura a evidência e CANCELA — nenhuma
// escrita no DB. (A persistência/gate são provados no pgTAP
// editar_card_universal_test.sql e no vitest do wrapper.)
//
// Título marcado [live] — excluído do CI padrão por `--grep-invert "\[live\]"`.
// Rodar: npx playwright test e2e/card-universal-editar.live.spec.ts

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

// Admin (CTO) — is_admin: vê/edita todo cliente via caminho (A) do predicado.
const ADMIN_EMAIL = 'gabrielgipp04@gmail.com';
// Cliente com card PREENCHIDO (tela rica → affordance "Editar", não "Adicionar").
const CLIENT_NAME = 'Aj Import';

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

test.describe('[live] Card Universal — modo edição contra DB vivo', () => {
  test.skip(!haveCreds, 'Requer .env (anon) + .env.scripts (service role).');

  test('entra em edição in-place e captura evidência (não-destrutivo: cancela)', async ({
    page,
  }) => {
    const EVID = 'e2e/__evidence__';

    await logarComSessaoReal(page, await mintEmailOtp());
    await page.goto('/clientes-area');
    await expect(page).toHaveURL(/\/clientes-area$/);

    // Abre o cliente-alvo.
    const row = page.getByText(CLIENT_NAME, { exact: false }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();

    const dialog = page.getByRole('dialog');
    const cardPanel = dialog.locator('section').filter({ hasText: 'Card universal' }).first();
    await expect(cardPanel).toBeVisible({ timeout: 15_000 });
    await cardPanel.scrollIntoViewIfNeeded();

    // Evidência 1: leitura (read-mostly) com a affordance "Editar".
    await cardPanel.screenshot({ path: `${EVID}/card-universal-leitura.png` });

    // Entra em edição (progressive disclosure).
    await cardPanel.getByRole('button', { name: 'Editar' }).click();

    // Os controles de edição aparecem; o layout vira campos.
    await expect(cardPanel.getByRole('button', { name: 'Salvar' })).toBeVisible({ timeout: 10_000 });
    await expect(cardPanel.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    // Pelo menos um input editável (ex.: campo de Notas) é editável.
    const notas = cardPanel.locator('#cu-notes');
    await expect(notas).toBeVisible();

    // Evidência 2: o card em MODO EDIÇÃO com os campos.
    await cardPanel.screenshot({ path: `${EVID}/card-universal-edicao.png` });

    // Digita num campo para evidenciar o estado "com mudança" (botão Salvar ativo),
    // mas NÃO salva — cancela para não mutar o DB.
    await notas.click();
    await notas.fill('rascunho de evidência (não salvo)');
    await cardPanel.screenshot({ path: `${EVID}/card-universal-edicao-dirty.png` });

    await cardPanel.getByRole('button', { name: 'Cancelar' }).click();

    // Volta ao modo leitura — a affordance "Editar" reaparece.
    await expect(cardPanel.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 10_000 });
  });
});
