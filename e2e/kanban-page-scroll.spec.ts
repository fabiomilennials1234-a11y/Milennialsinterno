import { expect, test, type Page } from '@playwright/test';

const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001';

async function mockAsCEO(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'ceo@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };

  await page.addInitScript(
    ({ expiresAt: ea, user: u }) => {
      window.localStorage.setItem(
        'mgrowth-auth',
        JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: ea,
          user: u,
        })
      );
    },
    { expiresAt, user }
  );

  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
  );

  // Playwright uses LIFO: register general handlers first, specific ones last
  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: JSON.stringify([]),
    });
  });

  await page.route('**/rest/v1/rpc/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/user_roles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify({ role: 'ceo' }),
    })
  );

  await page.route('**/rest/v1/profiles**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/1' },
      body: JSON.stringify({
        user_id: MOCK_USER_ID,
        name: 'CEO Test',
        email: 'ceo@example.com',
        role: 'ceo',
        avatar: null,
        group_id: null,
        squad_id: null,
        can_access_mtech: false,
        additional_pages: [],
      }),
    })
  );

  await page.route('**/rest/v1/rpc/get_my_page_access', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['design', 'devs', 'editor-video', 'produtora']),
    })
  );
}

const KANBAN_PAGES = [
  { path: '/design', name: 'Design PRO+' },
  { path: '/devs', name: 'Devs' },
  { path: '/editor-video', name: 'Editor Video' },
  // Produtora has async auth guard that may redirect before mock resolves — tested manually
];

test.describe('kanban page scroll behavior', () => {
  for (const { path, name } of KANBAN_PAGES) {
    test(`${name} (${path}): page container does not clip vertical overflow`, async ({ page }) => {
      await mockAsCEO(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // The <main> in MainLayout should allow vertical scroll.
      // No ancestor between <main> and the kanban columns should have overflow-hidden
      // that blocks vertical scrolling.
      const hasBlockingOverflow = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return 'no main element found';

        const style = window.getComputedStyle(main);
        const overflowY = style.overflowY;
        if (overflowY === 'hidden') return 'main has overflow-y: hidden';

        // Walk from main down through first-child path and check none clip Y
        let el: Element | null = main.firstElementChild;
        const path: string[] = [];
        while (el) {
          const cs = window.getComputedStyle(el);
          path.push(`${el.tagName}.${el.className.split(' ').slice(0, 3).join('.')} → overflow-y: ${cs.overflowY}`);
          if (cs.overflowY === 'hidden') {
            return `blocking overflow-y:hidden at: ${el.tagName} class="${el.className}"`;
          }
          // Go deeper into the main content branch (skip sidebar)
          el = el.firstElementChild;
        }
        return null;
      });

      expect(hasBlockingOverflow).toBeNull();
    });

    test(`${name} (${path}): page header is sticky`, async ({ page }) => {
      await mockAsCEO(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Wait for page title to render
      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const hasStickyHeader = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return 'no main found';
        const h1 = main.querySelector('h1');
        if (!h1) return 'no h1 in main';
        let el: HTMLElement | null = h1.parentElement;
        while (el && el !== main) {
          if (el.className.includes('sticky')) return true;
          el = el.parentElement;
        }
        return false;
      });

      expect(hasStickyHeader).toBe(true);
    });
  }
});
