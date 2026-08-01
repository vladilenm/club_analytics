import { describe, expect, it } from 'vitest';
import type { MemberRecord } from './member';
import { buildDashboardModel, buildInsight } from './analytics';

const monthPlan = '1 месяц 💬';
const longerPlan = '6 месяцев (выгода 15%) 💬';

function member(overrides: Partial<MemberRecord>): MemberRecord {
  return {
    id: 'member',
    name: 'Тестовый участник',
    telegram: '@test_member',
    phone: '+79000000000',
    startedAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-02-01T00:00:00.000Z',
    startedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
    endsAtMs: Date.parse('2026-02-01T00:00:00.000Z'),
    status: 'active',
    plan: monthPlan,
    paymentCount: 1,
    lifetimeDays: 120,
    recurrent: false,
    ...overrides,
  };
}

const members: MemberRecord[] = [
  member({ id: 'active-month', recurrent: true, lifetimeDays: 120 }),
  member({
    id: 'active-longer',
    startedAt: '2026-02-01T00:00:00.000Z',
    endsAt: '2026-06-05T00:00:00.000Z',
    startedAtMs: Date.parse('2026-02-01T00:00:00.000Z'),
    endsAtMs: Date.parse('2026-06-05T00:00:00.000Z'),
    plan: longerPlan,
    paymentCount: 2,
    lifetimeDays: 124,
  }),
  member({
    id: 'churned-longer',
    status: 'churned',
    endsAt: '2026-02-15T00:00:00.000Z',
    endsAtMs: Date.parse('2026-02-15T00:00:00.000Z'),
    plan: longerPlan,
    lifetimeDays: 90,
  }),
  member({
    id: 'churned-month',
    status: 'churned',
    startedAt: '2026-02-10T00:00:00.000Z',
    endsAt: '2026-03-10T00:00:00.000Z',
    startedAtMs: Date.parse('2026-02-10T00:00:00.000Z'),
    endsAtMs: Date.parse('2026-03-10T00:00:00.000Z'),
    paymentCount: 2,
    lifetimeDays: 120,
  }),
];

describe('buildDashboardModel', () => {
  it('aggregates stats, plans, and a zero-filled chronological activity series', () => {
    expect(buildDashboardModel(members)).toMatchObject({
      stats: {
        total: 4, active: 2, churned: 2, retention: 50,
        averageActiveLifetime: 122, averageChurnedLifetime: 105,
        averageActivePayments: 1.5, averageChurnedPayments: 1.5,
        recurringActive: 1, onePaymentChurned: 1,
      },
      activePlans: [
        { plan: monthPlan, count: 1 },
        { plan: longerPlan, count: 1 },
      ],
    });
    expect(buildDashboardModel(members).months).toEqual([
      { month: '2026-01', joins: 2, churn: 0 },
      { month: '2026-02', joins: 2, churn: 1 },
      { month: '2026-03', joins: 0, churn: 1 },
    ]);
  });

  it('reports the actual longer-plan churn count in the insight', () => {
    expect(buildInsight(buildDashboardModel(members))).toContain('1');
  });

  it('returns zero churn cohort metrics when every member is active', () => {
    const model = buildDashboardModel(members.filter((current) => current.status === 'active'));

    expect(model.stats).toMatchObject({
      churned: 0,
      averageChurnedLifetime: 0,
      averageChurnedPayments: 0,
      onePaymentChurned: 0,
    });
  });
});
