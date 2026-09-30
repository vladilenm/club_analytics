import { isDuration, isHistoryRules, type Duration, type HistoryRules, type Transaction } from './model';

const dayMs = 86_400_000;

export interface AccessPeriod {
  userId: string;
  start: number;
  end: number;
  kind: 'new' | 'return';
}

export interface PeriodMetrics {
  opening: number;
  closing: number;
  joined: number;
  left: number;
  returned: number;
}

export function addDuration(timestamp: number, duration: Duration): number {
  if (duration.unit === 'days') return timestamp + duration.count * dayMs;
  const date = new Date(timestamp);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + duration.count);
  const endOfMonth = new Date(date);
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, endOfMonth.getUTCDate()));
  return date.getTime();
}

export function buildTimeline(transactions: readonly Transaction[], rules: HistoryRules): AccessPeriod[] {
  if (!isHistoryRules(rules)) throw new Error('Проверьте правила расчёта.');
  const members = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!Object.hasOwn(rules.durations, transaction.plan) || !isDuration(rules.durations[transaction.plan])) {
      throw new Error('Укажите срок каждого тарифа в правилах расчёта.');
    }
    const list = members.get(transaction.userId) ?? [];
    list.push(transaction);
    members.set(transaction.userId, list);
  }
  const periods: AccessPeriod[] = [];
  for (const [userId, payments] of members) {
    payments.sort((a, b) => Date.parse(a.paidAt) - Date.parse(b.paidAt));
    let current: AccessPeriod | undefined;
    for (const payment of payments) {
      const at = Date.parse(payment.paidAt);
      const continuous = current && at <= current.end + rules.gapHours * 3_600_000;
      const base = current && continuous && rules.renewal === 'remaining' ? Math.max(at, current.end) : at;
      const end = addDuration(base, rules.durations[payment.plan]);
      if (current && continuous) current.end = end;
      else {
        current = { userId, start: at, end, kind: current ? 'return' : 'new' };
        periods.push(current);
      }
    }
  }
  return periods;
}

export function calendarDate(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error('Выберите корректные даты начала и конца периода.');
  }
  return timestamp;
}

export function calculatePeriod(
  periods: readonly AccessPeriod[], from: string, to: string, exportDate: string,
): PeriodMetrics {
  const start = calendarDate(from);
  const lastDay = calendarDate(to);
  const cutoff = calendarDate(exportDate);
  if (start > lastDay) throw new Error('Начало периода должно быть не позже конца.');
  if (lastDay > cutoff) throw new Error('Конец периода не может быть позже даты выгрузки.');
  const end = lastDay + dayMs;
  const sets = {
    opening: new Set<string>(), closing: new Set<string>(), joined: new Set<string>(),
    left: new Set<string>(), returned: new Set<string>(),
  };
  for (const period of periods) {
    if (period.start < start && period.end >= start) sets.opening.add(period.userId);
    if (period.start < end && period.end >= end) sets.closing.add(period.userId);
    if (period.start >= start && period.start < end) {
      sets[period.kind === 'new' ? 'joined' : 'returned'].add(period.userId);
    }
    if (period.end >= start && period.end < end) sets.left.add(period.userId);
  }
  return {
    opening: sets.opening.size, closing: sets.closing.size, joined: sets.joined.size,
    left: sets.left.size, returned: sets.returned.size,
  };
}
