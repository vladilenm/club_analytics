import { test, expect } from '@playwright/test';

test('imports a CSV, updates the dashboard, and restores it after reload', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByText('Загрузите CSV')).toBeVisible();
  await page.getByLabel('Загрузить CSV').setInputFiles('e2e/fixtures/members.csv');
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('@example_active')).toBeVisible();
  await page.reload();
  await expect(page.getByText('@example_active')).toBeVisible();
  await page.getByRole('tab', { name: 'Отменившие' }).click();
  await expect(page.getByText('@example_churned')).toBeVisible();
  await expect(page.getByText('@example_active')).not.toBeVisible();
  expect(externalRequests).toEqual([]);
});
