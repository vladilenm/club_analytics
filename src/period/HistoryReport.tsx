import { useMemo, useState } from 'react';
import { buildTimeline, calculatePeriod, type PeriodMetrics } from './analytics';
import { HistoryRulesForm } from './HistoryRulesForm';
import type { HistoryRules } from './model';
import type { HistorySnapshot } from './repository';

interface Props {
  snapshot: HistorySnapshot;
  busy: boolean;
  onSaveRules(rules: HistoryRules): Promise<void>;
}

const dateLabel = (value: string) => value.split('-').reverse().join('.');

export function HistoryReport({ snapshot, busy, onSaveRules }: Props) {
  const { transactions, metadata, rules } = snapshot;
  const [from, setFrom] = useState(`${metadata.exportDate.slice(0, 7)}-01`);
  const [to, setTo] = useState(metadata.exportDate);
  const [month, setMonth] = useState(metadata.exportDate.slice(0, 7));
  const timeline = useMemo(() => {
    try { return { periods: buildTimeline(transactions, rules), error: null }; }
    catch (error) { return { periods: null, error: (error as Error).message }; }
  }, [transactions, rules]);
  const plans = useMemo(() => [...new Set(transactions.map((t) => t.plan))].sort(), [transactions]);
  const people = useMemo(() => new Set(transactions.map((t) => t.userId)).size, [transactions]);
  let metrics: PeriodMetrics | null = null;
  let error = timeline.error;
  if (timeline.periods) {
    try { metrics = calculatePeriod(timeline.periods, from, to, metadata.exportDate); }
    catch (failure) { error = (failure as Error).message; }
  }

  function chooseMonth(value: string) {
    setMonth(value);
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    const last = new Date(`${value}-01T00:00:00Z`);
    if (!Number.isFinite(last.getTime())) return;
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    setFrom(`${value}-01`);
    const end = last.toISOString().slice(0, 10);
    setTo(end > metadata.exportDate ? metadata.exportDate : end);
  }

  const cards = [
    { label: 'На начало периода', key: 'opening', note: `до начала ${dateLabel(from)}`, tone: 'secondary' },
    { label: 'На конец периода', key: 'closing', note: `на конец ${dateLabel(to)}`, tone: 'secondary' },
    { label: 'Новые', key: 'joined', note: 'первая выдача доступа', tone: 'active' },
    { label: 'Ушедшие', key: 'left', note: 'закончился доступ', tone: 'churned' },
    { label: 'Вернувшиеся', key: 'returned', note: 'доступ после перерыва', tone: 'retention' },
  ] as const;

  return (
    <>
      <div className="period-controls">
        <label>Месяц<input type="month" value={month} max={metadata.exportDate.slice(0, 7)} onChange={(event) => chooseMonth(event.target.value)} /></label>
        <span className="period-or">или период</span>
        <label>С<input type="date" value={from} max={metadata.exportDate} onChange={(event) => { setFrom(event.target.value); setMonth(''); }} /></label>
        <label>По<input type="date" value={to} max={metadata.exportDate} onChange={(event) => { setTo(event.target.value); setMonth(''); }} /></label>
        <span className="period-timezone">Включительно · UTC</span>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {error ? <p className="period-error" role="alert">{error}</p> : null}
        <ul className="period-kpis" aria-label="Показатели за период">
          {cards.map((card) => (
            <li className="kpi" key={card.key}>
              <span className="lab">{card.label}</span>
              <strong className={`val ${card.tone}`}>{metrics ? metrics[card.key].toLocaleString('ru-RU') : '—'}</strong>
              <span className="note">{card.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="period-assumption">{rules.renewal === 'payment' ? 'Срок от даты оплаты' : 'Срок добавляется к остатку'} · {rules.gapHours === 0 ? 'учитывается любой перерыв' : `перерывы до ${rules.gapHours} ч объединены`}.</p>
      <p className="period-explanation">Даты окончания восстановлены по тарифам. Ручные изменения доступа и возвраты денег не учтены.</p>
      {to === metadata.exportDate ? <p className="period-notice">День выгрузки может быть неполным. Показатели на конец этого дня предварительные.</p> : null}
      <p className="period-explanation">Считаем людей, а не платежи. Один участник может уйти и вернуться за выбранный период. Уход означает окончание расчётного доступа, а не отключение автоплатежа.</p>
      <HistoryRulesForm plans={plans} rules={rules} busy={busy} onSave={onSaveRules} />
      <footer className="period-source">
        <span>{metadata.fileName}</span>
        <span>{transactions.length.toLocaleString('ru-RU')} операций · {people.toLocaleString('ru-RU')} участников · выгрузка от {dateLabel(metadata.exportDate)}</span>
      </footer>
    </>
  );
}
