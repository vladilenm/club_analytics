import { describe, expect, it } from 'vitest';
import { addDuration, buildTimeline, calculatePeriod } from './analytics';
import { createRules, type Transaction } from './model';
import { parseTransactionsCsv } from './parseTransactionsCsv';

const tx = (userId: string, date: string, plan = '1 месяц 💬'): Transaction => ({
  userId, paidAt: `${date}T00:00:00.000Z`, plan,
});
const csv = (lines: string[]) => 'USER_ID,date,merchant,merchant_info,sum,plan,reflink,promo,comment\n' + lines.join('\n');
const row = (date: string, extra = '') => `test,${date},ACCESS_LINK,acclink,0.00,"Старт",,,${extra}`;

describe('transaction import', () => {
  it('retains access links and repeated members, normalizes timestamps and ignores private columns', () => {
    const result = parseTransactionsCsv(csv([row('2026-09-01 00:00:00'), row('2026-09-29T03:00:00+03:00', 'auto 1DAY')]));
    expect(result).toEqual([tx('test', '2026-09-01', 'Старт'), tx('test', '2026-09-29', 'Старт')]);
  });
  it.each([
    csv([row('2026-02-30 00:00:00')]),
    csv([row('2026-09-01 00:00:00'), row('2026-09-01 00:00:00')]),
    csv([row('2026-09-01 00:00:00').replace('0.00', '-100.00')]),
    csv([row('2026-09-01 00:00:00').replace('test,', ',')]),
    csv([row('2026-09-01 00:00:00').replace('"Старт"', '""')]),
    'USER_ID,date\n1,2026-09-01',
    'USER_ID,date,date,merchant,merchant_info,sum,plan,reflink,promo,comment\ntest,2026-01-01 00:00:00,2026-09-01 00:00:00,PRODAMUS,test,100,Старт,,,',
    csv([]),
  ])('rejects invalid/ambiguous histories without exposing rows', (source) => {
    expect(() => parseTransactionsCsv(source)).toThrow();
  });
});

describe('access reconstruction', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2024-02-29', 12, '2025-02-28'],
    ['2026-11-30', 3, '2027-02-28'],
  ])('clamps %s plus %s calendar months to %s', (start, count, end) => {
    expect(addDuration(Date.parse(`${start}T12:30:00Z`), { count, unit: 'months' }))
      .toBe(Date.parse(`${end}T12:30:00Z`));
  });
  it('keeps early payments continuous and supports both renewal rules', () => {
    const transactions = [tx('a', '2026-08-01'), tx('a', '2026-08-31')];
    const rules = createRules(transactions);
    expect(buildTimeline(transactions, rules)).toEqual([
      { userId: 'a', start: Date.parse('2026-08-01'), end: Date.parse('2026-09-30'), kind: 'new' },
    ]);
    expect(buildTimeline(transactions, { ...rules, renewal: 'remaining' })[0].end)
      .toBe(Date.parse('2026-10-01'));
  });
  it('uses the new plan when a renewal replaces a longer subscription', () => {
    const transactions = [tx('a', '2026-08-01', '6 месяцев (выгода 15%) 💬'), tx('a', '2026-09-01')];
    expect(buildTimeline(transactions, createRules(transactions))[0].end).toBe(Date.parse('2026-10-01'));
  });
  it('uses 3 months for the autumn plan and seven days for the week', () => {
    const transactions = [tx('a', '2026-09-01', 'Осенний AI-Сезон'), tx('b', '2026-09-01', 'Неделя в «Незаменимых»')];
    const periods = buildTimeline(transactions, createRules(transactions));
    expect(periods.map((p) => p.end)).toEqual([Date.parse('2026-12-01'), Date.parse('2026-09-08')]);
  });
  it('requires a duration for an unknown tariff instead of silently skipping people', () => {
    const transactions = [tx('a', '2026-09-01', 'Новый тариф')];
    expect(() => buildTimeline(transactions, createRules(transactions))).toThrow('срок');
  });
  it('supports a zero or one-hour tolerance for technical gaps', () => {
    const transactions = [tx('a', '2026-08-01'), { ...tx('a', '2026-09-01'), paidAt: '2026-09-01T00:00:10.000Z' }];
    const rules = createRules(transactions);
    expect(buildTimeline(transactions, { ...rules, gapHours: 0 })).toHaveLength(2);
    expect(buildTimeline(transactions, { ...rules, gapHours: 1 })).toHaveLength(1);
  });
});

describe('period metrics', () => {
  const transactions = [
    tx('steady', '2026-08-10', '6 месяцев (выгода 15%) 💬'),
    tx('leaves', '2026-08-15'),
    tx('new', '2026-09-30'),
    tx('returns', '2026-07-01'), tx('returns', '2026-09-15'),
    tx('repeat', '2026-08-15', 'Неделя в «Незаменимых»'),
    tx('repeat', '2026-09-01', 'Неделя в «Незаменимых»'),
    tx('repeat', '2026-09-10', 'Неделя в «Незаменимых»'),
    tx('repeat', '2026-09-20', 'Неделя в «Незаменимых»'),
  ];
  const periods = buildTimeline(transactions, createRules(transactions));
  it('counts unique people, including several returns and a join on the last day', () => {
    expect(calculatePeriod(periods, '2026-09-01', '2026-09-30', '2026-09-30'))
      .toEqual({ opening: 2, closing: 3, joined: 1, left: 2, returned: 2 });
  });
  it('includes events at opening and excludes the next midnight', () => {
    const ts = [tx('old', '2026-08-01'), tx('new', '2026-09-01'), tx('tomorrow', '2026-09-02')];
    expect(calculatePeriod(buildTimeline(ts, createRules(ts)), '2026-09-01', '2026-09-01', '2026-09-30'))
      .toEqual({ opening: 1, closing: 1, joined: 1, left: 1, returned: 0 });
  });
  it('handles a period before the first transaction', () => {
    expect(calculatePeriod(periods, '2026-01-01', '2026-01-31', '2026-09-30'))
      .toEqual({ opening: 0, closing: 0, joined: 0, left: 0, returned: 0 });
  });
  it.each([
    ['', '2026-09-30'], ['2026-09-20', '2026-09-01'],
    ['2026-09-01', '2026-10-01'], ['2026-02-30', '2026-03-01'],
  ])('rejects invalid dates or future results: %s to %s', (from, to) => {
    expect(() => calculatePeriod(periods, from, to, '2026-09-30')).toThrow();
  });
});
