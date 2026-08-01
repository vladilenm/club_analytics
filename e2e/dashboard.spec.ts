import { test, expect, type Request } from '@playwright/test';

const expectedOrigin = 'http://127.0.0.1:4173';
const fixtureTokens = [
  'fictional-active',
  'fictional-churned',
  'example_active',
  'example_churned',
  'fictional active',
  'fictional churned',
  '70000000001',
  '70000000002',
];

function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function inspectRequest(request: Request): string[] {
  const violations: string[] = [];
  const url = new URL(request.url());
  const body = request.postData() ?? '';
  const searchableRequest = decoded(`${url.href}\n${body}`).toLocaleLowerCase('en');

  if (url.origin !== expectedOrigin) violations.push('unexpected request origin');
  if (request.method() !== 'GET') violations.push('non-GET request');
  if (body !== '') violations.push('request body present');
  if (url.search !== '') violations.push('unexpected request query');
  if (url.pathname !== '/' && url.pathname !== '/index.html' && !/^\/assets\/[A-Za-z0-9._-]+\.(?:css|js)$/.test(url.pathname)) {
    violations.push('unexpected request path');
  }
  if (fixtureTokens.some((token) => searchableRequest.includes(token))) {
    violations.push('synthetic fixture token in request');
  }

  return violations;
}

test('imports a CSV, updates the dashboard, and restores it without sending member data', async ({ page }) => {
  const networkViolations: string[] = [];

  page.on('websocket', () => {
    networkViolations.push('WebSocket connection attempted');
  });
  await page.route('**/*', async (route) => {
    const violations = inspectRequest(route.request());
    if (violations.length > 0) {
      networkViolations.push(...violations);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await expect(page).toHaveURL(`${expectedOrigin}/`);
  await expect(page.getByText('Загрузите CSV')).toBeVisible();
  await page.getByLabel('Загрузить CSV').setInputFiles('e2e/fixtures/members.csv');
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('@example_active')).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(`${expectedOrigin}/`);
  await expect(page.getByText('@example_active')).toBeVisible();
  await page.getByRole('tab', { name: 'Отменившие' }).click();
  await expect(page.getByText('@example_churned')).toBeVisible();
  await expect(page.getByText('@example_active')).not.toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(networkViolations).toEqual([]);
});
