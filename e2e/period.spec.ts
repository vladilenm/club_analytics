import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';
import { makeCsv, makeRawMember } from '../src/test/csvFixture';

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

test('opens and exports the exact historical cohort, including returned people and missing contacts', async ({ page }) => {
  const history = [
    ...Array.from({ length: 9 }, (_, index) => [`person-${index}`, '2026-09-03']),
    ...Array.from({ length: 6 }, (_, index) => [`person-${index}`, '2026-10-05']),
    ['new', '2026-10-06'],
  ];
  const historyCsv = 'USER_ID,date,merchant,merchant_info,sum,plan,reflink,promo,comment\n'
    + history.map(([id, date]) => `${id},${date} 00:00:00,PRODAMUS,fixture,100.00,Старт,,,`).join('\n');
  const contactsCsv = makeCsv([
    ...Array.from({ length: 9 }, (_, index) => makeRawMember({
      USER_ID: `person-${index}`, name: `Участник ${index}`, username: `test_person_${index}`, active: index < 6 ? '1' : '0',
    })),
    makeRawMember({ USER_ID: 'new', name: 'Новый участник', username: 'test_new' }),
  ]);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/');
  await page.getByLabel('CSV транзакций').setInputFiles({ name: 'history-2026-10-07.csv', mimeType: 'text/csv', buffer: Buffer.from(historyCsv) });
  const section = page.getByRole('region', { name: 'Показатели за период', exact: true });
  const leftCard = section.getByRole('button', { name: 'Ушедшие: 9 — показать участников', exact: true });
  await leftCard.focus();
  await page.keyboard.press('Enter');
  const list = section.getByRole('region', { name: 'Ушедшие за период', exact: true });
  await expect(list.getByRole('row')).toHaveCount(10);
  await expect(list.getByText('Нет в CSV', { exact: true })).toHaveCount(9);
  await expect(list.getByText('person-8', { exact: true })).toBeVisible();

  await page.locator('#csv-file').setInputFiles({ name: 'members-2026-10-07.csv', mimeType: 'text/csv', buffer: Buffer.from(contactsCsv) });
  await expect(list.getByRole('row')).toHaveCount(10);
  await expect(list.getByRole('link', { name: '@test_person_0', exact: true })).toHaveAttribute('href', 'https://t.me/test_person_0');
  await expect(list.getByText('Активен', { exact: true })).toHaveCount(6);
  await expect(list.getByText('Отменил', { exact: true })).toHaveCount(3);
  await page.getByRole('tab', { name: 'Отменившие', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Участники', exact: true }).getByRole('row')).toHaveCount(4);
  await expect(list.getByRole('row')).toHaveCount(10);

  const downloadReady = page.waitForEvent('download');
  await list.getByRole('button', { name: 'Скачать CSV', exact: true }).click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe('club-left-2026-10-01-2026-10-07.csv');
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Missing downloaded CSV');
  const downloadedCsv = await readFile(downloadPath, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(downloadedCsv, { header: true });
  expect(parsed.errors).toEqual([]);
  expect(parsed.data).toHaveLength(9);
  expect(parsed.data.filter((row) => row['Статус в CSV участников'] === 'Активен')).toHaveLength(6);
  expect(new Set(parsed.data.map((row) => row.USER_ID)).size).toBe(9);
  await section.screenshot({ path: 'test-results/period-participants-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(list.getByRole('button', { name: 'Скачать CSV', exact: true })).toBeVisible();
  await section.screenshot({ path: 'test-results/period-participants-mobile.png' });

  await section.getByLabel('С', { exact: true }).fill('2026-10-04');
  await expect(list.getByText('За выбранный период таких участников нет.', { exact: true })).toBeVisible();
  await expect(list.getByRole('button', { name: 'Скачать CSV', exact: true })).toBeDisabled();
  await section.getByRole('button', { name: 'Новые: 1 — показать участников', exact: true }).click();
  const joined = section.getByRole('region', { name: 'Новые за период', exact: true });
  await expect(joined.getByText('Новый участник', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Вернувшиеся: 6 — показать участников', exact: true }).click();
  const returned = section.getByRole('region', { name: 'Вернувшиеся за период', exact: true });
  await expect(returned.getByRole('row')).toHaveCount(7);
  await section.getByText('Как учитываются возвращения и правило 30 дней', { exact: true }).click();
  await expect(section.getByText(/Возвращение раньше 30 дней тоже учитывается/)).toBeVisible();
  await returned.getByRole('button', { name: 'Закрыть список', exact: true }).click();
  await expect(section.getByRole('button', { name: 'Вернувшиеся: 6 — показать участников', exact: true })).toBeFocused();
});
