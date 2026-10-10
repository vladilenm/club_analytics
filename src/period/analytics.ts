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

export type PeriodEventKey = 'joined' | 'left' | 'returned';

export interface PeriodParticipant {
  userId: string;
  dates: number[];
  activeAtEnd: boolean;
}

export interface PeriodReport {
  metrics: PeriodMetrics;
  events: Record<PeriodEventKey, PeriodParticipant[]>;
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
  return calculatePeriodReport(periods, from, to, exportDate).metrics;
}

export function calculatePeriodReport(
  periods: readonly AccessPeriod[], from: string, to: string, exportDate: string,
): PeriodReport {
  const start = calendarDate(from);
  const lastDay = calendarDate(to);
  const cutoff = calendarDate(exportDate);
  if (start > lastDay) throw new Error('Начало периода должно быть не позже конца.');
  if (lastDay > cutoff) throw new Error('Конец периода не может быть позже даты выгрузки.');
  const end = lastDay + dayMs;
  const opening = new Set<string>();
  const closing = new Set<string>();
  const events: Record<PeriodEventKey, Map<string, number[]>> = {
    joined: new Map(), left: new Map(), returned: new Map(),
  };
  function addEvent(key: PeriodEventKey, userId: string, date: number) {
    const dates = events[key].get(userId) ?? [];
    dates.push(date);
    events[key].set(userId, dates);
  }
  for (const period of periods) {
    if (period.start < start && period.end >= start) opening.add(period.userId);
    if (period.start < end && period.end >= end) closing.add(period.userId);
    if (period.start >= start && period.start < end) {
      addEvent(period.kind === 'new' ? 'joined' : 'returned', period.userId, period.start);
    }
    if (period.end >= start && period.end < end) addEvent('left', period.userId, period.end);
  }
  function participants(key: PeriodEventKey): PeriodParticipant[] {
    return [...events[key]].map(([userId, dates]) => ({
      userId, dates: dates.sort((a, b) => a - b), activeAtEnd: closing.has(userId),
    }));
  }
  return {
    metrics: {
      opening: opening.size, closing: closing.size, joined: events.joined.size,
      left: events.left.size, returned: events.returned.size,
    },
    events: { joined: participants('joined'), left: participants('left'), returned: participants('returned') },
  };
}
