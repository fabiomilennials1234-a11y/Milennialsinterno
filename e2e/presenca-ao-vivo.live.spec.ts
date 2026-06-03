// Slice 5 (#81) — Presença ao vivo, DUAS SESSÕES contra o canal REAL. ADR 0007.
//
// Prova ponta-a-ponta que: um usuário (Gustavo, ENVOLVIDO de Bertin — caminho C)
// entra no canal private de presença do cliente e faz track({atuando:true});
// e OUTRO usuário (Gabriel, admin — bypass A), no MESMO canal, VÊ o primeiro
// atuando em tempo real, via o BadgeAtuando. Os dois passam pela RLS de
// realtime.messages (canal private + cliente.pode_ver_cliente) — se a policy
// barrasse, o observador não receberia presença e o badge ficaria vazio.
//
// Não mocka rede: sessões `authenticated` REAIS (magic-link via service role ->
// verifyOtp no browser), dois BrowserContexts isolados. Usa um harness DEV-only
// (/__presenca_harness) parametrizado por querystring — não toca página de produto
// nem persiste nada (presença é efêmera, em memória; #83 é a persistência).
//
// Título [live] — excluído do CI por `--grep-invert "\[live\]"`.
// Rodar: npx playwright test e2e/presenca-ao-vivo.live.spec.ts

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

// Cliente real (Bertin) + dois usuários que PODEM vê-lo: admin (A) e envolvido (C).
const CLIENT_ID = '676ee8e9-3a2b-4735-be7c-fb1454aee14d';
const OBSERVADOR_EMAIL = 'gabrielgipp04@gmail.com'; // admin — bypass A
const OBSERVADOR_ID = '07e5f01d-3b28-488a-a061-202150a8c8fe';
const ANUNCIANTE_EMAIL = 'gugask177@gmail.com'; // Gustavo — envolvido (ads_manager) C
const ANUNCIANTE_ID = '683c085f-8749-4584-b914-8521451af4dc';
// Demanda sintética: o channel é por CLIENTE; demanda_id é só payload do track
// (não validado pela RLS do canal). Fixo para o badge agrupar.
const DEMANDA_ID = '00000000-0000-0000-0000-0000000d1111';

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

function harnessUrl(papel: 'anuncia' | 'observa', userId: string): string {
  const q = new URLSearchParams({
    papel,
    client: CLIENT_ID,
    demanda: DEMANDA_ID,
    user: userId,
  });
  return `/__presenca_harness?${q.toString()}`;
}

test.describe('[live] Presença ao vivo — duas sessões no canal real', () => {
  test.skip(!haveCreds, 'Requer .env (anon) + .env.scripts (service role).');

  test('observador vê o anunciante atuando em tempo real (canal private autorizado)', async ({
    browser,
  }) => {
    // Dois contextos isolados = dois usuários distintos no mesmo canal.
    let ctxAnuncia: BrowserContext | null = null;
    let ctxObserva: BrowserContext | null = null;
    try {
      ctxAnuncia = await browser.newContext();
      ctxObserva = await browser.newContext();
      const anuncia = await ctxAnuncia.newPage();
      const observa = await ctxObserva.newPage();

      // Logins reais (sequencial p/ não floodar generate_link).
      await logar(anuncia, ANUNCIANTE_EMAIL, await mintOtp(ANUNCIANTE_EMAIL));
      await logar(observa, OBSERVADOR_EMAIL, await mintOtp(OBSERVADOR_EMAIL));

      // Anunciante entra no canal e faz track (atuando inferido: focado + input).
      await anuncia.goto(harnessUrl('anuncia', ANUNCIANTE_ID));
      await expect(anuncia.getByTestId('estado-anuncia')).toBeVisible({ timeout: 20_000 });
      // Gera input para garantir atuando=true (não-idle).
      await anuncia.mouse.move(200, 200);
      await anuncia.mouse.move(260, 240);
      await expect(anuncia.getByTestId('estado-anuncia')).toHaveAttribute(
        'data-atuando',
        'true',
        { timeout: 15_000 },
      );

      // Observador assina o MESMO canal e deve ver o anunciante surgir no badge.
      await observa.goto(harnessUrl('observa', OBSERVADOR_ID));
      await expect(observa.getByTestId('presenca-harness')).toBeVisible({ timeout: 20_000 });

      // PROVA: o observador recebe a presença do anunciante (≥1 presente) e o
      // badge renderiza "atuando agora" — atravessou a RLS do canal private.
      await expect(observa.getByTestId('contagem-presentes')).toContainText('1', {
        timeout: 25_000,
      });
      const badge = observa.getByTestId('badge-host');
      await expect(badge.getByText(/atuando agora/i)).toBeVisible({ timeout: 25_000 });

      // Evidência: o badge ao vivo visto pelo observador.
      await badge.screenshot({ path: `${EVID}/presenca-badge-atuando-live.png` });
      await observa.screenshot({ path: `${EVID}/presenca-observador-live.png`, fullPage: true });

      // Segunda evidência: ANUNCIANTE auto-pausa quando o observador continua e o
      // anunciante fica ocioso. Recarrega o anunciante com idle curto (2s) e NÃO
      // gera input — o badge do observador deve passar de "atuando" para "presente".
      await anuncia.goto(harnessUrl('anuncia', ANUNCIANTE_ID) + '&idle=2000');
      await expect(anuncia.getByTestId('estado-anuncia')).toBeVisible({ timeout: 20_000 });
      // sem mexer mouse/teclado; o heartbeat reavalia -> atuando vira false.
      await expect(anuncia.getByTestId('estado-anuncia')).toHaveAttribute(
        'data-atuando',
        'false',
        { timeout: 40_000 },
      );
    } finally {
      await ctxAnuncia?.close();
      await ctxObserva?.close();
    }
  });
});
