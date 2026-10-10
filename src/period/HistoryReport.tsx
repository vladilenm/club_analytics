import { useMemo, useRef, useState } from 'react';
import type { DashboardSnapshot } from '../storage/snapshotRepository';
import { buildTimeline, calculatePeriodReport, type PeriodEventKey } from './analytics';
import { HistoryRulesForm } from './HistoryRulesForm';
import { PeriodParticipants } from './PeriodParticipants';
import type { HistoryRules } from './model';
import type { HistorySnapshot } from './repository';

interface Props {
  snapshot: HistorySnapshot;
  memberSnapshot?: DashboardSnapshot | null;
  busy: boolean;
  onSaveRules(rules: HistoryRules): Promise<void>;
}

const dateLabel = (value: string) => value.split('-').reverse().join('.');

export function HistoryReport({ snapshot, memberSnapshot = null, busy, onSaveRules }: Props) {
  const { transactions, metadata, rules } = snapshot;
  const [from, setFrom] = useState(`${metadata.exportDate.slice(0, 7)}-01`);
  const [to, setTo] = useState(metadata.exportDate);
  const [month, setMonth] = useState(metadata.exportDate.slice(0, 7));
  const [selected, setSelected] = useState<PeriodEventKey | null>(null);
  const cardRefs = useRef<Partial<Record<PeriodEventKey, HTMLButtonElement | null>>>({});
  const timeline = useMemo(() => {
    try { return { periods: buildTimeline(transactions, rules), error: null }; }
    catch (error) { return { periods: null, error: (error as Error).message }; }
  }, [transactions, rules]);
  const plans = useMemo(() => [...new Set(transactions.map((t) => t.plan))].sort(), [transactions]);
  const people = useMemo(() => new Set(transactions.map((t) => t.userId)).size, [transactions]);
  const { report, error } = useMemo(() => {
    if (!timeline.periods) return { report: null, error: timeline.error };
    try {
      return { report: calculatePeriodReport(timeline.periods, from, to, metadata.exportDate), error: null };
    } catch (failure) { return { report: null, error: (failure as Error).message }; }
  }, [timeline, from, to, metadata.exportDate]);
  const metrics = report?.metrics ?? null;

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
          {cards.map((card) => {
            const eventKey = card.key === 'joined' || card.key === 'left' || card.key === 'returned' ? card.key : null;
            const value = metrics ? metrics[card.key].toLocaleString('ru-RU') : '—';
            const content = <>
              <span className="lab">{card.label}</span>
              <strong className={`val ${card.tone}`}>{value}</strong>
              <span className="note">{card.note}</span>
            </>;
            return (
              <li className={`kpi${eventKey ? ' period-kpi-clickable' : ''}`} key={card.key}>
                {eventKey ? (
                  <button
                    ref={(element) => { cardRefs.current[eventKey] = element; }}
                    className="period-kpi-button"
                    type="button"
                    disabled={!metrics || busy}
                    aria-label={`${card.label}: ${value} — показать участников`}
                    aria-expanded={!!report && selected === eventKey}
                    aria-controls="period-participants"
                    onClick={() => setSelected((current) => current === eventKey ? null : eventKey)}
                  >
                    {content}
                    <span className="period-kpi-action">{selected === eventKey && report ? 'Скрыть список ↑' : 'Показать список ↓'}</span>
                  </button>
                ) : content}
              </li>
            );
          })}
        </ul>
      </div>
      {selected && report ? (
        <PeriodParticipants
          event={selected}
          participants={report.events[selected]}
          memberSnapshot={memberSnapshot}
          from={from}
          to={to}
          historyExportDate={metadata.exportDate}
          onClose={() => { cardRefs.current[selected]?.focus(); setSelected(null); }}
        />
      ) : null}
      <p className="period-assumption">{rules.renewal === 'payment' ? 'Срок от даты оплаты' : 'Срок добавляется к остатку'} · {rules.gapHours === 0 ? 'учитывается любой перерыв' : `перерывы до ${rules.gapHours} ч объединены`}.</p>
      <p className="period-explanation">Даты окончания восстановлены по тарифам. Ручные изменения доступа и возвраты денег не учтены.</p>
      {to === metadata.exportDate ? <p className="period-notice">День выгрузки может быть неполным. Показатели на конец этого дня предварительные.</p> : null}
      <p className="period-explanation">Считаем людей, а не платежи. Один участник может уйти и вернуться за выбранный период. Уход означает окончание расчётного доступа, а не отключение автоплатежа.</p>
      <p className="period-explanation">«Отменившие» в таблице ниже — текущий статус из CSV участников. «Ушедшие» здесь — окончания расчётного доступа за выбранные даты, включая тех, кто уже вернулся. Поэтому эти числа могут различаться.</p>
      <details className="period-return-help">
        <summary>Как учитываются возвращения и правило 30 дней</summary>
        <p>Возвращение раньше 30 дней тоже учитывается в этой аналитике, если перерыв больше технического допуска. Продление без такого перерыва возвращением не считается.</p>
        <p>Правило «не менее 30 дней отсутствия, оплата в течение 14 дней после подтверждённой коммуникации, не чаще одного раза за 90 дней» относится к отдельному KPI менеджера. Данных о коммуникации здесь нет, поэтому этот KPI не рассчитывается. Это правило не требует откладывать сообщения ушедшим: с ними можно связываться каждую неделю.</p>
      </details>
      <HistoryRulesForm plans={plans} rules={rules} busy={busy} onSave={onSaveRules} />
      <footer className="period-source">
        <span>{metadata.fileName}</span>
        <span>{transactions.length.toLocaleString('ru-RU')} операций · {people.toLocaleString('ru-RU')} участников · выгрузка от {dateLabel(metadata.exportDate)}</span>
      </footer>
    </>
  );
}
