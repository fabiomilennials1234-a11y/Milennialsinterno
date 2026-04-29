import { expect, test, type Page } from '@playwright/test';

const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001';
const MOCK_EMAIL = 'qa-smoke@example.com';

type MockAuthOptions = {
  role?: string;
  pageGrants?: string[];
};

const PAGE_ACCESS_ROUTES = [
  { path: '/financeiro', pageSlug: 'financeiro' },
  { path: '/financeiro-dashboard', pageSlug: 'financeiro' },
  { path: '/gestor-crm', pageSlug: 'gestor-crm' },
  { path: '/design', pageSlug: 'design' },
  { path: '/editor-video', pageSlug: 'editor-video' },
  { path: '/atrizes-gravacao', pageSlug: 'atrizes-gravacao' },
  { path: '/devs', pageSlug: 'devs' },
  { path: '/rh', pageSlug: 'rh' },
  { path: '/kanban/design', pageSlug: 'design' },
  { path: '/kanban/crm', pageSlug: 'gestor-crm' },
  { path: '/kanban/produtora', pageSlug: 'produtora' },
];

const ADMIN_ONLY_ROUTES = [
  '/dashboard',
  '/millennials-growth',
  '/mktplace-dashboard',
  '/gestor-projetos',
  '/admin/configuracoes',
  '/admin/grupos',
];

const MANAGER_ROUTES = [
  '/cadastro-clientes',
  '/admin/usuarios',
];

async function mockSupabase(page: Page, options: MockAuthOptions = {}) {
  const role = options.role ?? 'financeiro';
  const pageGrants = options.pageGrants ?? [];
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
      body: JSON.stringify(pageGrants),
    });
  });

  await page.route('**/rest/v1/profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify({
        user_id: MOCK_USER_ID,
        name: 'QA Smoke',
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

}

test.describe('smoke: auth and page grants', () => {
  test('redirects unauthenticated users from protected routes to login', async ({ page }) => {
    await page.goto('/financeiro');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('allows a granted user to open a page protected by PageAccessRoute', async ({ page }) => {
    await mockSupabase(page, { role: 'financeiro', pageGrants: ['financeiro'] });

    await page.goto('/financeiro');

    await expect(page).toHaveURL(/\/financeiro$/);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('shows a stable access denied state for authenticated users without the page grant', async ({ page }) => {
    await mockSupabase(page, { role: 'financeiro', pageGrants: [] });

    await page.goto('/financeiro');

    await expect(page).toHaveURL(/\/financeiro$/);
    await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  for (const route of PAGE_ACCESS_ROUTES) {
    test(`allows ${route.path} when the matching page grant exists`, async ({ page }) => {
      await mockSupabase(page, {
        role: 'financeiro',
        pageGrants: [route.pageSlug],
      });

      await page.goto(route.path);

      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page.locator('#root')).not.toBeEmpty();
    });

    test(`denies ${route.path} without route loops when the page grant is missing`, async ({ page }) => {
      await mockSupabase(page, { role: 'financeiro', pageGrants: [] });

      await page.goto(route.path);

      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    });
  }

  for (const path of ADMIN_ONLY_ROUTES) {
    test(`shows stable access denied for non-admin on ${path}`, async ({ page }) => {
      await mockSupabase(page, { role: 'financeiro', pageGrants: [] });

      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    });
  }

  for (const path of MANAGER_ROUTES) {
    test(`shows stable access denied for non-manager on ${path}`, async ({ page }) => {
      await mockSupabase(page, { role: 'financeiro', pageGrants: [] });

      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    });
  }
});
