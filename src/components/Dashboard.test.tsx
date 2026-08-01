import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDashboardModel } from '../domain/analytics';
import type { MemberRecord } from '../domain/member';
import { Dashboard } from './Dashboard';

afterEach(cleanup);

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

describe('Dashboard', () => {
  it('renders the six KPI cards and the generated insight', () => {
    render(<Dashboard members={members} model={buildDashboardModel(members)} />);

    const kpis = screen.getByRole('list', { name: 'Ключевые показатели' });
    const expectedCards = [
      ['Всего в базе', '4'],
      ['Активные', '2'],
      ['Отменившие', '2'],
      ['Retention', '50%'],
      ['Ср. жизнь активного', '122 дн'],
      ['Ср. жизнь ушедшего', '105 дн'],
    ];

    expect(within(kpis).getAllByRole('listitem')).toHaveLength(6);
    for (const [label, value] of expectedCards) {
      const card = within(kpis).getByText(label, { exact: true }).closest('li');
      expect(card).not.toBeNull();
      expect(card).toHaveTextContent(label);
      expect(card).toHaveTextContent(value);
    }
    expect(screen.getByText(
      'Удержание составляет 50%. Отток после одной оплаты: 1. Отток на длительных тарифах: 1.',
    )).toBeInTheDocument();
  });

  it('shows exact active plan counts and accessible monthly activity labels', () => {
    render(<Dashboard members={members} model={buildDashboardModel(members)} />);

    const plans = screen.getByRole('region', { name: 'Тарифы активных участников' });
    expect(within(plans).getByText(monthPlan)).toBeInTheDocument();
    expect(within(plans).getByText(longerPlan)).toBeInTheDocument();
    expect(within(plans).getAllByText('1')).toHaveLength(2);

    expect(screen.getByText('Январь 2026: 2 новых, 0 отмен')).toBeInTheDocument();
    expect(screen.getByText('Февраль 2026: 2 новых, 1 отмена')).toBeInTheDocument();
    expect(screen.getByText('Март 2026: 0 новых, 1 отмена')).toBeInTheDocument();
  });
});
