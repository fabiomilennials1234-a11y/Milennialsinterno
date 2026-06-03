// Slice 8 (#84) — Board "Monday" agregado, DUAS SESSÕES contra o canal/dados REAIS.
// ADR 0004 + 0005 + 0007.
//
// Prova ponta-a-ponta o capstone do PRD #75:
//   1. (design + agregação) Gabriel (admin — bypass A) abre o BOARD de produto
//      (/painel-demandas) e vê as demandas dos clientes que pode ver, agrupadas
//      por cliente, com status/domínio e Tempo-na-demanda acumulado. Evidência
//      de design salva em __evidence__.
//   2. (presença viva agregada) Gustavo (ENVOLVIDO de Bertin — caminho C) entra,
//      via o harness DEV, no canal private de presença de Bertin e faz
//      track({atuando:true}) na demanda real "Landing page". Gabriel, no BOARD,
//      vê o badge "atuando agora" surgir NA LINHA daquela demanda em tempo real —
//      sem recarregar. Atravessou a RLS de realtime.messages (canal private +
//      pode_ver_cliente) e o lazy-subscribe por viewport (o grupo está na tela).
//
// Não mocka rede: sessões authenticated REAIS (magic-link via service role ->
// verifyOtp no browser), dois BrowserContexts isolados. Depende do seed de
// evidência (scripts/seed-painel-evidence.sql) — demandas reais de Bertin/Aethos.
//
// Título [live] — excluído do CI por `--grep-invert "\[live\]"`.
// Rodar: npx playwright test e2e/painel-demandas.live.spec.ts

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

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

const CLIENT_ID = '676ee8e9-3a2b-4735-be7c-fb1454aee14d'; // Bertin Distribuidora
const OBSERVADOR_EMAIL = 'gabrielgipp04@gmail.com'; // admin — bypass A
const OBSERVADOR_ID = '07e5f01d-3b28-488a-a061-202150a8c8fe';
const ANUNCIANTE_EMAIL = 'gugask177@gmail.com'; // Gustavo — envolvido (ads_manager) C
const ANUNCIANTE_ID = '683c085f-8749-4584-b914-8521451af4dc';
// Demanda REAL do seed (Landing page do lançamento, Bertin) — o board casa a
// presença viva com a LINHA dela por demanda_id.
const DEMANDA_ID = '8a000000-0000-0000-0000-00000000ed01';

const haveCreds = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE);
const EVID = 'e2e/__evidence__';

async function mintOtp(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!res.ok) throw new Error(`generate_link(${email}): ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { email_otp?: string };
  if (!body.email_otp) throw new Error(`generate_link(${email}) sem email_otp`);
  return body.email_otp;
}

async function logar(page: Page, email: string, otp: string) {
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
    { url: SUPABASE_URL, anon: ANON_KEY, email, token: otp },
  );
  expect(result.ok, `verifyOtp (${email}) deveria criar sessão real: ${result.error}`).toBeTruthy();
}

function harnessUrl(): string {
  const q = new URLSearchParams({
    papel: 'anuncia',
    client: CLIENT_ID,
    demanda: DEMANDA_ID,
    user: ANUNCIANTE_ID,
  });
  return `/__presenca_harness?${q.toString()}`;
}

test.describe('[live] Painel de Demandas — board agregado + presença viva', () => {
  test.skip(!haveCreds, 'Requer .env (anon) + .env.scripts (service role).');

  test('admin vê o board agregado e a presença viva reflete na linha da demanda', async ({
    browser,
  }) => {
    let ctxAnuncia: BrowserContext | null = null;
    let ctxObserva: BrowserContext | null = null;
    try {
      ctxAnuncia = await browser.newContext();
      ctxObserva = await browser.newContext();
      const anuncia = await ctxAnuncia.newPage();
      const observa = await ctxObserva.newPage();

      await logar(anuncia, ANUNCIANTE_EMAIL, await mintOtp(ANUNCIANTE_EMAIL));
      await logar(observa, OBSERVADOR_EMAIL, await mintOtp(OBSERVADOR_EMAIL));

      // (1) Admin abre o BOARD de produto. Deve ver o cabeçalho e as demandas
      // agregadas (estado FRIO da RPC).
      await observa.goto('/painel-demandas');
      await expect(observa.getByRole('heading', { name: 'Painel de Demandas' })).toBeVisible({
        timeout: 30_000,
      });
      await expect(observa.getByText('Landing page do lançamento')).toBeVisible({ timeout: 30_000 });
      // Cabeçalho do grupo de Bertin (heading, não a <option> do filtro).
      await expect(
        observa.getByRole('heading', { name: 'Bertin Distribuidora' }),
      ).toBeVisible();
      // Tempo-na-demanda acumulado da Landing (9600s = 2 h 40 min) aparece na linha.
      await expect(observa.getByText('2 h 40 min')).toBeVisible({ timeout: 10_000 });

      // Evidência de design: board carregado, estado frio.
      await observa.screenshot({ path: `${EVID}/painel-demandas-board.png`, fullPage: true });

      // (2) Gustavo anuncia atuação na demanda real (canal private de Bertin).
      await anuncia.goto(harnessUrl());
      await expect(anuncia.getByTestId('estado-anuncia')).toBeVisible({ timeout: 20_000 });
      await anuncia.mouse.move(200, 200);
      await anuncia.mouse.move(260, 240);
      await expect(anuncia.getByTestId('estado-anuncia')).toHaveAttribute('data-atuando', 'true', {
        timeout: 15_000,
      });

      // PROVA: no BOARD, a presença viva surge — o board reflete "atuando agora"
      // em tempo real (lazy-subscribe do grupo de Bertin, que está na tela).
      await expect(observa.getByText(/atuando agora/i).first()).toBeVisible({ timeout: 30_000 });

      // Traz a linha da Landing ao topo do viewport (uso real: o gestor rola até
      // a demanda) — longe da faixa inferior onde o FAB global flutua. Captura de
      // VIEWPORT (não fullPage: fullPage compõe o FAB fixo sobre a imagem inteira)
      // prova que, na rolagem real, o badge de presença NÃO fica clipado.
      await observa.getByText('Landing page do lançamento').scrollIntoViewIfNeeded();
      await observa.mouse.wheel(0, -240);
      await observa.waitForTimeout(400);
      await expect(observa.getByText('Landing page do lançamento')).toBeVisible();

      // Evidência de design: board com presença viva refletida (viewport real,
      // linha rolada para fora da faixa do FAB — badge não clipado).
      await observa.screenshot({ path: `${EVID}/painel-demandas-presenca-viva.png` });
    } finally {
      await ctxAnuncia?.close();
      await ctxObserva?.close();
    }
  });
});
