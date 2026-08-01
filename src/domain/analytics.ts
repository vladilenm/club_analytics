import type { MemberRecord } from './member';

export interface DashboardStats {
  total: number;
  active: number;
  churned: number;
  retention: number;
  averageActiveLifetime: number;
  averageChurnedLifetime: number;
  averageActivePayments: number;
  averageChurnedPayments: number;
  recurringActive: number;
  onePaymentChurned: number;
}

export interface MonthPoint {
  month: string;
  joins: number;
  churn: number;
}

export interface PlanPoint {
  plan: string;
  count: number;
}

export interface DashboardModel {
  stats: DashboardStats;
  months: MonthPoint[];
  activePlans: PlanPoint[];
  churnedPlans: PlanPoint[];
}

interface Totals {
  active: number;
  churned: number;
  activeLifetime: number;
  churnedLifetime: number;
  activePayments: number;
  churnedPayments: number;
  recurringActive: number;
  onePaymentChurned: number;
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function average(total: number, count: number, round: (value: number) => number): number {
  return count === 0 ? 0 : round(total / count);
}

function toPlanPoints(counts: Map<string, number>): PlanPoint[] {
  return [...counts].map(([plan, count]) => ({ plan, count })).sort((left, right) => {
    return right.count - left.count || left.plan.localeCompare(right.plan, 'ru');
  });
}

export function buildDashboardModel(members: readonly MemberRecord[]): DashboardModel {
  const totals: Totals = {
    active: 0,
    churned: 0,
    activeLifetime: 0,
    churnedLifetime: 0,
    activePayments: 0,
    churnedPayments: 0,
    recurringActive: 0,
    onePaymentChurned: 0,
  };
  const joins = new Map<string, number>();
  const churn = new Map<string, number>();
  const activePlans = new Map<string, number>();
  const churnedPlans = new Map<string, number>();

  for (const member of members) {
    incrementCount(joins, member.startedAt.slice(0, 7));

    if (member.status === 'active') {
      totals.active += 1;
      totals.activeLifetime += member.lifetimeDays;
      totals.activePayments += member.paymentCount;
      if (member.recurrent) totals.recurringActive += 1;
      incrementCount(activePlans, member.plan);
      continue;
    }

    totals.churned += 1;
    totals.churnedLifetime += member.lifetimeDays;
    totals.churnedPayments += member.paymentCount;
    if (member.paymentCount <= 1) totals.onePaymentChurned += 1;
    incrementCount(churn, member.endsAt.slice(0, 7));
    incrementCount(churnedPlans, member.plan);
  }

  const months = [...new Set([...joins.keys(), ...churn.keys()])]
    .sort()
    .map((month) => ({ month, joins: joins.get(month) ?? 0, churn: churn.get(month) ?? 0 }));
  const total = members.length;

  return {
    stats: {
      total,
      active: totals.active,
      churned: totals.churned,
      retention: average(totals.active * 100, total, (value) => Math.round(value * 10) / 10),
      averageActiveLifetime: average(totals.activeLifetime, totals.active, Math.trunc),
      averageChurnedLifetime: average(totals.churnedLifetime, totals.churned, Math.trunc),
      averageActivePayments: average(totals.activePayments, totals.active, (value) => Math.round(value * 10) / 10),
      averageChurnedPayments: average(totals.churnedPayments, totals.churned, (value) => Math.round(value * 10) / 10),
      recurringActive: totals.recurringActive,
      onePaymentChurned: totals.onePaymentChurned,
    },
    months,
    activePlans: toPlanPoints(activePlans),
    churnedPlans: toPlanPoints(churnedPlans),
  };
}

export function buildInsight(model: DashboardModel): string {
  const longerPlanChurned = model.churnedPlans
    .filter(({ plan }) => {
      const normalizedPlan = plan.trim().toLocaleLowerCase('ru');
      return !normalizedPlan.startsWith('1 месяц') && normalizedPlan !== 'старт';
    })
    .reduce((total, { count }) => total + count, 0);

  return `Удержание составляет ${model.stats.retention}%. Отток после одной оплаты: ${model.stats.onePaymentChurned}. Отток на длительных тарифах: ${longerPlanChurned}.`;
}
