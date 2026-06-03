// Slice 6 (#83) — Evidência E2E do wiring de Tempo-na-demanda + Presença viva,
// contra DB VIVO. Como demandas-do-cliente.live.spec.ts: NÃO mocka rede; usa sessão
// `authenticated` REAL (magic-link via service role -> verifyOtp no browser).
//
// Prova o WIRING do produto (#83): no modal de cliente, a linha de demanda mostra o
// chip de Tempo-na-demanda acumulado, alimentado por intervalos FECHADOS reais
// persistidos via o contrato `presenca.registrar_intervalo` e lidos via
// `presenca.tempo_por_demanda_do_cliente` (schema presenca exposto no PostgREST).
//
// Não-destrutivo: cria UMA demanda marcada, registra 2 intervalos disjuntos nela,
// screenshota a linha enriquecida, e APAGA demanda + intervalos ao final via service
// role (fora de RLS). Estado final == inicial.
//
// Título marcado [live] — excluído do CI padrão por `--grep-invert "\[live\]"`.
// Rodar: npx playwright test e2e/tempo-na-demanda.live.spec.ts

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
const TITULO_TESTE = `__E2E Tempo ${Date.now()}`;

const haveCreds = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE && PROJECT_ID && ACCESS_TOKEN);

async function sqlAdmin(query: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`sqlAdmin ${res.status}: ${await res.text()}`);
  return res.json();
}

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

async function limparTeste() {
  // Apaga intervalos e demandas de teste (fora de RLS, service role).
  await sqlAdmin(
    "DELETE FROM presenca.atuacao_intervalos WHERE demanda_id IN " +
      "(SELECT id FROM demanda.demandas WHERE titulo LIKE '\\_\\_E2E Tempo %');",
  ).catch(() => {});
  await sqlAdmin("DELETE FROM demanda.demandas WHERE titulo LIKE '\\_\\_E2E Tempo %';").catch(
    () => {},
  );
}

test.describe('[live] Tempo-na-demanda — wiring #83 contra DB vivo', () => {
  test.skip(!haveCreds, 'Requer .env (anon) + .env.scripts (service role + access token).');

  test.afterAll(async () => {
    await limparTeste();
  });

  test('chip de Tempo-na-demanda renderiza a partir de intervalos persistidos reais', async ({
    page,
  }) => {
    // 1. Cria a demanda + 2 intervalos disjuntos (10min + 8min = 18min) via service
    //    role, no cliente real. client_id resolvido pelo nome.
    const created = (await sqlAdmin(
      `WITH c AS (SELECT id FROM public.clients WHERE name = ${quote(CLIENT_NAME)} LIMIT 1),
            d AS (
              INSERT INTO demanda.demandas (client_id, titulo, dominio)
              SELECT c.id, ${quote(TITULO_TESTE)}, 'design' FROM c
              RETURNING id, client_id
            ),
            i AS (
              INSERT INTO presenca.atuacao_intervalos (client_id, demanda_id, user_id, inicio, fim)
              SELECT d.client_id, d.id,
                     (SELECT id FROM auth.users WHERE email = ${quote(ADMIN_EMAIL)} LIMIT 1),
                     t.inicio, t.fim
              FROM d, (VALUES
                (now() - interval '30 min', now() - interval '20 min'),
                (now() - interval '10 min', now() - interval '2 min')
              ) AS t(inicio, fim)
              RETURNING 1
            )
       SELECT (SELECT id FROM d) AS demanda_id, (SELECT count(*) FROM i) AS n;`,
    )) as Array<{ demanda_id: string; n: number }>;
    expect(created?.[0]?.n).toBe(2);

    // 2. Sessão real + abre o modal do cliente.
    await logarComSessaoReal(page, await mintEmailOtp());
    await page.goto('/clientes-area');
    await expect(page).toHaveURL(/\/clientes-area$/);

    const tempoResp = page.waitForResponse(
      (r) =>
        /\/rest\/v1\/rpc\/tempo_por_demanda_do_cliente(\?|$)/.test(r.url()) &&
        r.status() >= 200 &&
        r.status() < 300,
      { timeout: 25_000 },
    );

    const row = page.getByText(CLIENT_NAME, { exact: false }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Demandas do cliente' })).toBeVisible({
      timeout: 15_000,
    });
    await tempoResp; // prova: tempo veio da RPC presenca.tempo_por_demanda_do_cliente.

    // 3. A linha da demanda de teste mostra o chip de tempo "18 min".
    const linha = dialog.locator('li').filter({ hasText: TITULO_TESTE }).first();
    await expect(linha).toBeVisible({ timeout: 15_000 });
    await expect(linha.getByText('18 min')).toBeVisible({ timeout: 10_000 });

    // 4. Evidência: a linha enriquecida + o painel.
    const EVID = 'e2e/__evidence__';
    const painel = dialog.locator('section').filter({ hasText: 'Demandas do cliente' }).first();
    await painel.scrollIntoViewIfNeeded();
    await linha.screenshot({ path: `${EVID}/tempo-na-demanda-linha.png` });
    await painel.screenshot({ path: `${EVID}/tempo-na-demanda-painel.png` });
  });
});

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
