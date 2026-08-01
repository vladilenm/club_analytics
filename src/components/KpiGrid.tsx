import type { DashboardStats } from '../domain/analytics';

export interface KpiGridProps {
  stats: DashboardStats;
}

interface KpiCard {
  label: string;
  value: string;
  note: string;
  tone?: 'active' | 'churned' | 'retention' | 'secondary';
}

export function KpiGrid({ stats }: KpiGridProps) {
  const cards: KpiCard[] = [
    { label: 'Всего в базе', value: String(stats.total), note: 'за всё время' },
    {
      label: 'Активные',
      value: String(stats.active),
      note: `${stats.recurringActive} с автоплатежом`,
      tone: 'active',
    },
    {
      label: 'Отменившие',
      value: String(stats.churned),
      note: `${stats.onePaymentChurned} ушли после 1-го платежа`,
      tone: 'churned',
    },
    {
      label: 'Retention',
      value: `${stats.retention}%`,
      note: 'доля активных от базы',
      tone: 'retention',
    },
    {
      label: 'Ср. жизнь активного',
      value: `${stats.averageActiveLifetime} дн`,
      note: `${stats.averageActivePayments} платежа в среднем`,
      tone: 'secondary',
    },
    {
      label: 'Ср. жизнь ушедшего',
      value: `${stats.averageChurnedLifetime} дн`,
      note: `всего ${stats.averageChurnedPayments} платежа`,
    },
  ];

  return (
    <ul className="kpis" aria-label="Ключевые показатели">
      {cards.map((card) => (
        <li className="kpi" key={card.label}>
          <span className="lab">{card.label}</span>
          <strong className={`val${card.tone ? ` ${card.tone}` : ''}`}>{card.value}</strong>
          <span className="note">{card.note}</span>
        </li>
      ))}
    </ul>
  );
}
