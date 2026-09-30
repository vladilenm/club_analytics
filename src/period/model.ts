export interface Transaction {
  userId: string;
  paidAt: string;
  plan: string;
}

export interface Duration {
  count: number;
  unit: 'months' | 'days';
}

export interface HistoryRules {
  renewal: 'payment' | 'remaining';
  gapHours: number;
  durations: Record<string, Duration>;
}

const defaultMonths: Record<string, number> = {
  '1 месяц': 1,
  '6 месяцев (выгода 15%)': 6,
  '12 месяцев (выгода 25%)': 12,
  'Старт': 1,
  'Практика (-15%)': 6,
  'Система (-25%)': 12,
  'Осенний AI-Сезон': 3,
};

export function createRules(transactions: readonly Transaction[], previous?: HistoryRules): HistoryRules {
  const durations: Record<string, Duration> = Object.create(null) as Record<string, Duration>;
  for (const { plan } of transactions) {
    const saved = previous && Object.hasOwn(previous.durations, plan) ? previous.durations[plan] : undefined;
    const name = plan.replace(/\s*💬$/u, '').trim();
    const months = Object.hasOwn(defaultMonths, name) ? defaultMonths[name] : undefined;
    if (saved) durations[plan] = { ...saved };
    else if (months) durations[plan] = { count: months, unit: 'months' };
    else if (name === 'Неделя в «Незаменимых»') durations[plan] = { count: 7, unit: 'days' };
  }
  return { renewal: previous?.renewal ?? 'payment', gapHours: previous?.gapHours ?? 1, durations };
}

export function isDuration(value: unknown): value is Duration {
  if (!value || typeof value !== 'object') return false;
  const duration = value as Duration;
  return (duration.unit === 'months' || duration.unit === 'days')
    && Number.isInteger(duration.count) && duration.count > 0 && duration.count <= 1200;
}

export function isHistoryRules(value: unknown): value is HistoryRules {
  if (!value || typeof value !== 'object') return false;
  const rules = value as HistoryRules;
  return (rules.renewal === 'payment' || rules.renewal === 'remaining')
    && Number.isFinite(rules.gapHours) && rules.gapHours >= 0 && rules.gapHours <= 168
    && !!rules.durations && typeof rules.durations === 'object' && !Array.isArray(rules.durations)
    && Object.values(rules.durations).every(isDuration);
}
