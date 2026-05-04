import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * E2E coverage for the justificativas convergence refactor.
 *
 * The branch `fix/justificativas-source-of-truth` migrates all delay
 * justification surfaces to the canonical RPC `get_justifications_team_grouped`.
 * These tests validate:
 *   A) Multi-table convergence — items from different task_tables render correctly.
 *   B) CEO vision — admin role sees all data via `seesAll`.
 *   C) Pseudo-table filter — `p_task_tables` param restricts results.
 *   D) Archive semantic — archiving operates on `task_delay_justifications.archived`,
 *      not on the task source, and the item disappears from active view.
 */

const MOCK_USER_ID = '00000000-0000-4000-8000-0000000000b1';
const MOCK_EMAIL = 'qa-convergence@example.com';

type MockOptions = {
  role?: string;
  pageGrants?: string[];
};

type TeamGroupedRow = {
  user_id: string;
  user_name: string;
  user_role: string;
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  justification_id: string | null;
  justification_text: string | null;
  master_comment: string | null;
  requires_revision: boolean;
  archived: boolean;
  created_at: string;
  client_name: string | null;
  department: string | null;
  justification_at: string | null;
  task_archived: boolean | null;
};

function makeTeamRow(overrides: Partial<TeamGroupedRow> & Pick<TeamGroupedRow, 'notification_id' | 'task_id' | 'task_table' | 'task_title'>): TeamGroupedRow {
  return {
    user_id: MOCK_USER_ID,
    user_name: 'QA Convergence',
    user_role: 'gestor_ads',
    task_due_date: '2026-04-15T00:00:00Z',
    justification_id: null,
    justification_text: null,
    master_comment: null,
    requires_revision: false,
    archived: false,
    created_at: '2026-04-16T00:00:00Z',
    client_name: null,
    department: null,
    justification_at: null,
    task_archived: false,
    ...overrides,
  };
}

async function mockSupabase(page: Page, options: MockOptions = {}) {
  const role = options.role ?? 'gestor_projetos';
  const pageGrants = options.pageGrants ?? ['gestor-projetos'];
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const user = {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: MOCK_EMAIL,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };

  await page.addInitScript(
    ({ expiresAt: injectedExpiresAt, user: injectedUser }) => {
      window.localStorage.setItem(
        'mgrowth-auth',
        JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: injectedExpiresAt,
          user: injectedUser,
        })
      );
    },
    { expiresAt, user }
  );

  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });

  // Catch-all REST (LIFO: registered first, lowest priority).
  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: JSON.stringify([]),
    });
  });

  // Catch-all RPCs.
  await page.route('**/rest/v1/rpc/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify({
        user_id: MOCK_USER_ID,
        name: 'QA Convergence',
        email: MOCK_EMAIL,
        role,
        avatar: null,
        group_id: null,
        squad_id: null,
        can_access_mtech: false,
        additional_pages: [],
      }),
    });
  });

  await page.route('**/rest/v1/user_roles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify({ role }),
    });
  });

  // Page access grant — registered last so LIFO makes it win over catch-all.
  await page.route('**/rest/v1/rpc/get_my_page_access', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageGrants),
    });
  });
}

function mockTeamGroupedRpc(page: Page, rows: TeamGroupedRow[]) {
  // Must be registered AFTER mockSupabase so it wins LIFO over catch-all RPCs.
  return page.route('**/rest/v1/rpc/get_justifications_team_grouped', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    });
  });
}

function mockArchiveRpc(page: Page) {
  return page.route(
    (url) =>
      url.pathname.includes('/rest/v1/rpc/archive_justification') ||
      url.pathname.includes('/rest/v1/rpc/unarchive_justification'),
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    }
  );
}

// ─── Recorded RPC calls for assertion ──────────────────────────────────────

type RecordedRpc = { url: string; body: string; ts: number };

function recordRpcCalls(page: Page, rpcName: string): RecordedRpc[] {
  const recorded: RecordedRpc[] = [];
  page.on('request', (request) => {
    if (request.url().includes(`/rest/v1/rpc/${rpcName}`)) {
      recorded.push({
        url: request.url(),
        body: request.postData() ?? '',
        ts: Date.now(),
      });
    }
  });
  return recorded;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test.describe('justifications convergence: RPC as source-of-truth', () => {
  test('A) multi-table convergence: counts per status render correctly', async ({ page }) => {
    await mockSupabase(page, { role: 'ceo', pageGrants: ['gestor-projetos'] });

    const rows: TeamGroupedRow[] = [
      // 2 atrasados (no justification) from different tables
      makeTeamRow({
        notification_id: 'n-com-1',
        task_id: 't-com-1',
        task_table: 'comercial_tasks',
        task_title: 'Proposta ACME',
        department: 'comercial',
        client_name: 'ACME Corp',
      }),
      makeTeamRow({
        notification_id: 'n-ads-1',
        task_id: 't-ads-1',
        task_table: 'ads_tasks',
        task_title: 'Campanha Google',
        department: 'ads',
      }),
      // 1 justificado
      makeTeamRow({
        notification_id: 'n-dept-1',
        task_id: 't-dept-1',
        task_table: 'department_tasks',
        task_title: 'Relatório Design',
        department: 'design',
        justification_id: 'j-1',
        justification_text: 'Cliente pediu adiamento',
        justification_at: '2026-04-16T10:00:00Z',
      }),
      // 1 requer_revisao
      makeTeamRow({
        notification_id: 'n-kan-1',
        task_id: 't-kan-1',
        task_table: 'kanban_cards',
        task_title: 'Card Kanban',
        department: 'kanban',
        justification_id: 'j-2',
        justification_text: 'Justificativa fraca',
        requires_revision: true,
      }),
    ];

    await mockTeamGroupedRpc(page, rows);
    await page.goto('/gestor-projetos');

    // Wait for the section to render within the horizontally scrollable board.
    // The SquadDelaysJustificationsSection shows summary cards with counts.
    await page.waitForLoadState('networkidle');

    // Summary cards: 2 Atrasados, 1 Revisao, 1 Justificados
    const atrasadosCount = page.locator('text=Atrasados').locator('..');
    await expect(atrasadosCount).toBeVisible({ timeout: 10_000 });
    await expect(atrasadosCount.locator('p.text-lg')).toHaveText('2');

    const revisaoCount = page.locator('text=Revisão').locator('..');
    await expect(revisaoCount).toBeVisible();
    await expect(revisaoCount.locator('p.text-lg')).toHaveText('1');

    const justificadosCount = page.locator('text=Justificados').locator('..');
    await expect(justificadosCount).toBeVisible();
    await expect(justificadosCount.locator('p.text-lg')).toHaveText('1');

    // Verify individual task titles render
    await expect(page.getByText('Proposta ACME')).toBeVisible();
    await expect(page.getByText('Campanha Google')).toBeVisible();
    await expect(page.getByText('Relatório Design')).toBeVisible();
    await expect(page.getByText('Card Kanban')).toBeVisible();

    // Client name from comercial_tasks is shown
    await expect(page.getByText('ACME Corp')).toBeVisible();
  });

  test('B) CEO vision: admin sees all data from RPC', async ({ page }) => {
    await mockSupabase(page, { role: 'ceo', pageGrants: ['gestor-projetos'] });

    const rows: TeamGroupedRow[] = [
      makeTeamRow({
        notification_id: 'n-ceo-1',
        task_id: 't-ceo-1',
        task_table: 'comercial_tasks',
        task_title: 'CEO Sees This',
        department: 'comercial',
        user_name: 'Employee Alpha',
        user_role: 'consultor_comercial',
        client_name: 'Big Client',
      }),
      makeTeamRow({
        notification_id: 'n-ceo-2',
        task_id: 't-ceo-2',
        task_table: 'ads_tasks',
        task_title: 'CEO Sees Ads Too',
        department: 'ads',
        user_name: 'Employee Beta',
        user_role: 'gestor_ads',
      }),
    ];

    await mockTeamGroupedRpc(page, rows);

    const rpcCalls = recordRpcCalls(page, 'get_justifications_team_grouped');
    await page.goto('/gestor-projetos');
    await page.waitForLoadState('networkidle');

    // RPC was called (proves the component consumes it)
    expect(rpcCalls.length).toBeGreaterThan(0);

    // Both items visible — CEO sees cross-department
    await expect(page.getByText('CEO Sees This')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('CEO Sees Ads Too')).toBeVisible();
    await expect(page.getByText('Big Client')).toBeVisible();

    // Summary shows 2 atrasados
    const atrasadosCount = page.locator('text=Atrasados').locator('..');
    await expect(atrasadosCount.locator('p.text-lg')).toHaveText('2');
  });

  test('C) pseudo-table filter: RPC receives p_task_tables param', async ({ page }) => {
    await mockSupabase(page, { role: 'ceo', pageGrants: ['gestor-projetos'] });

    // Return only comercial_tasks items (simulating server-side filter).
    const rows: TeamGroupedRow[] = [
      makeTeamRow({
        notification_id: 'n-filt-1',
        task_id: 't-filt-1',
        task_table: 'comercial_tasks',
        task_title: 'Filtered Comercial',
        department: 'comercial',
      }),
    ];

    await mockTeamGroupedRpc(page, rows);

    // Record the actual RPC body to verify p_task_tables was sent.
    const rpcCalls = recordRpcCalls(page, 'get_justifications_team_grouped');
    await page.goto('/gestor-projetos');
    await page.waitForLoadState('networkidle');

    // Component passes REAL_TASK_TABLES = ['comercial_tasks','ads_tasks','department_tasks','kanban_cards']
    expect(rpcCalls.length).toBeGreaterThan(0);
    const firstCall = rpcCalls[0];
    const body = JSON.parse(firstCall.body);

    // Verify the param is sent.
    expect(body).toHaveProperty('p_task_tables');
    expect(body.p_task_tables).toEqual(
      expect.arrayContaining(['comercial_tasks', 'ads_tasks', 'department_tasks', 'kanban_cards'])
    );

    // Only the filtered item renders.
    await expect(page.getByText('Filtered Comercial')).toBeVisible({ timeout: 10_000 });
  });

  test('D) archive semantic: uses justification archived, item disappears from active', async ({
    page,
  }) => {
    await mockSupabase(page, { role: 'ceo', pageGrants: ['gestor-projetos'] });

    const justificationId = 'j-archive-1';

    // Phase 1: item is active with a justification (archive button visible).
    const activeRows: TeamGroupedRow[] = [
      makeTeamRow({
        notification_id: 'n-arch-1',
        task_id: 't-arch-1',
        task_table: 'department_tasks',
        task_title: 'Task To Archive',
        department: 'design',
        justification_id: justificationId,
        justification_text: 'Motivo valido',
        justification_at: '2026-04-16T10:00:00Z',
        archived: false,
      }),
    ];

    await mockTeamGroupedRpc(page, activeRows);
    await mockArchiveRpc(page);
    await page.goto('/gestor-projetos');
    await page.waitForLoadState('networkidle');

    // Item is visible with archive button.
    await expect(page.getByText('Task To Archive')).toBeVisible({ timeout: 10_000 });
    const archiveButton = page.getByRole('button', { name: /Arquivar/i });
    await expect(archiveButton).toBeVisible();

    // Phase 2: Click archive. After mutation, the refetch returns the item
    // without a justification (RPC excludes archived justifications via
    // `j.archived = false` in LEFT JOIN). The notification reappears as "atrasado".
    const postArchiveRows: TeamGroupedRow[] = [
      makeTeamRow({
        notification_id: 'n-arch-1',
        task_id: 't-arch-1',
        task_table: 'department_tasks',
        task_title: 'Task To Archive',
        department: 'design',
        // Justification is gone (archived server-side, excluded by RPC join).
        justification_id: null,
        justification_text: null,
        justification_at: null,
        archived: false,
      }),
    ];

    // Record archive RPC calls to verify it targets the justification table.
    const archiveCalls = recordRpcCalls(page, 'archive_justification');

    // Re-register the team grouped mock to return post-archive data on refetch.
    await page.route('**/rest/v1/rpc/get_justifications_team_grouped', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(postArchiveRows),
      });
    });

    await archiveButton.click();

    // Verify archive RPC was called with the justification ID.
    await expect.poll(() => archiveCalls.length, { timeout: 5000 }).toBeGreaterThan(0);
    const archiveBody = JSON.parse(archiveCalls[0].body);
    expect(archiveBody).toHaveProperty('p_id', justificationId);

    // After refetch, "Justificado" badge should be gone; task now shows as "Atrasado".
    await expect(page.getByText('Atrasado').first()).toBeVisible({ timeout: 5000 });

    // The archive button should be gone (no justification_id to archive).
    await expect(page.getByRole('button', { name: /Arquivar/i })).toHaveCount(0);
  });
});
