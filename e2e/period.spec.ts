import { test, expect } from '@playwright/test';

const transactions = [
  ['steady', '2026-08-10', '6 месяцев (выгода 15%) 💬'],
  ['leaves', '2026-08-15', 'Старт'],
  ['new', '2026-09-30', 'Старт'],
  ['returns', '2026-07-01', 'Старт'],
  ['returns', '2026-09-15', 'Старт'],
];
const source = 'USER_ID,date,merchant,merchant_info,sum,plan,reflink,promo,comment\n'
  + transactions.map(([id, date, plan]) => `${id},${date} 00:00:00,PRODAMUS,fixture,100.00,${plan},,,`).join('\n');

test('calculates a period, preserves valid data and assumptions, and restores locally', async ({ page }) => {
  const unexpectedRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173/') || request.method() !== 'GET') {
      unexpectedRequests.push(request.url());
    }
  });
  await page.goto('/');
  const section = page.getByRole('region', { name: 'Показатели за период', exact: true });
  const input = page.getByLabel('CSV транзакций');
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name: 'history-2026-09-30.csv', mimeType: 'text/csv', buffer: Buffer.from(source) });
  const cards = section.getByRole('list', { name: 'Показатели за период' }).getByRole('listitem');
  await expect(cards.locator('.val')).toHaveText(['2', '3', '1', '1', '1']);
  await section.getByLabel('По', { exact: true }).fill('2026-09-14');
  await expect(cards.locator('.val')).toHaveText(['2', '2', '0', '0', '0']);
  await section.getByLabel('Месяц', { exact: true }).fill('2026-09');
  await expect(cards.locator('.val')).toHaveText(['2', '3', '1', '1', '1']);

  await input.setInputFiles({ name: 'broken.csv', mimeType: 'text/csv', buffer: Buffer.from('broken') });
  await expect(section.getByRole('alert')).toBeVisible();
  await expect(cards.locator('.val')).toHaveText(['2', '3', '1', '1', '1']);
  await section.getByText('Правила расчёта и сроки тарифов', { exact: true }).click();
  await section.getByLabel('При продлении', { exact: true }).selectOption('remaining');
  await section.getByLabel('Объединять перерывы до, часов').fill('2');
  await section.getByRole('button', { name: 'Применить правила' }).click();
  await expect(section.getByText('Срок добавляется к остатку · перерывы до 2 ч объединены.')).toBeVisible();
  await page.reload();
  await expect(cards.locator('.val')).toHaveText(['2', '3', '1', '1', '1']);
  await expect(section.getByText('Срок добавляется к остатку · перерывы до 2 ч объединены.')).toBeVisible();

  await section.getByLabel('С', { exact: true }).fill('2026-10-01');
  await expect(section.getByRole('alert')).toHaveText('Начало периода должно быть не позже конца.');
  await expect(cards.locator('.val')).toHaveText(['—', '—', '—', '—', '—']);
  expect(unexpectedRequests).toEqual([]);
});

test('requires an unknown tariff duration and supports a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const input = page.getByLabel('CSV транзакций');
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name: 'history-2026-09-30.csv', mimeType: 'text/csv', buffer: Buffer.from(source.replaceAll('Старт', 'Спецтариф')) });
  const section = page.getByRole('region', { name: 'Показатели за период', exact: true });
  await expect(section.getByRole('alert')).toContainText('Укажите срок');
  await section.getByLabel('Спецтариф', { exact: true }).fill('1');
  await section.getByRole('button', { name: 'Применить правила' }).click();
  await expect(section.getByRole('listitem').locator('.val')).toHaveText(['2', '3', '1', '1', '1']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/period-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await section.getByText('Правила расчёта и сроки тарифов', { exact: true }).click();
  await page.screenshot({ path: 'test-results/period-desktop.png', fullPage: true });
});
