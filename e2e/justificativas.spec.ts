import { expect, test, type Page } from '@playwright/test';

const MOCK_USER_ID = '00000000-0000-4000-8000-000000000099';
const MOCK_EMAIL = 'qa-justif@example.com';

type PendingItem = {
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  task_owner_id: string;
  task_owner_name: string;
  task_owner_role: string;
  master_comment: string | null;
  requires_revision: boolean;
  created_at: string;
};

async function mockAuth(page: Page) {
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

  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/rpc/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/rpc/get_my_page_access', async (route) => {
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
        name: 'QA Justif',
        email: MOCK_EMAIL,
        role: 'design',
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
      body: JSON.stringify({ role: 'design' }),
    });
  });
}

async function mockJustifPending(page: Page, items: PendingItem[]) {
  await page.route('**/rest/v1/rpc/get_justifications_pending_mine', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(items),
    });
  });
}

test.describe('justificativas', () => {
  test('TaskDelayModal não aparece após login', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/');
    await page.waitForTimeout(1500);
    await expect(page.getByText(/urgente.*tarefa atrasada/i)).toHaveCount(0);
    await expect(page.getByText(/urgente.*onboarding atrasado/i)).toHaveCount(0);
  });

  test('badge mostra quando há pendência e leva para /justificativas', async ({ page }) => {
    await mockAuth(page);
    await mockJustifPending(page, [
      {
        notification_id: 'n1',
        task_id: 't1',
        task_table: 'department_tasks',
        task_title: 'Tarefa A',
        task_due_date: '2026-04-01T00:00:00Z',
        task_owner_id: MOCK_USER_ID,
        task_owner_name: 'QA Justif',
        task_owner_role: 'design',
        master_comment: null,
        requires_revision: false,
        created_at: '2026-04-01T00:00:00Z',
      },
      {
        notification_id: 'n2',
        task_id: 't2',
        task_table: 'department_tasks',
        task_title: 'Tarefa B',
        task_due_date: '2026-04-02T00:00:00Z',
        task_owner_id: MOCK_USER_ID,
        task_owner_name: 'QA Justif',
        task_owner_role: 'design',
        master_comment: null,
        requires_revision: false,
        created_at: '2026-04-02T00:00:00Z',
      },
    ]);

    await page.goto('/');

    const badge = page.getByRole('link', { name: /justificativas/i }).first();
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await expect(badge.getByText('2')).toBeVisible();

    await badge.click();
    await expect(page).toHaveURL(/\/justificativas$/);
    await expect(page.getByRole('heading', { name: 'Justificativas' })).toBeVisible();
  });

  test('badge oculto quando count = 0', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/');
    await page.waitForTimeout(1000);
    const badges = page.getByRole('link', { name: /^justificativas$/i });
    await expect(badges).toHaveCount(0);
  });
});
