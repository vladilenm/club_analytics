import { useMemo } from 'react';
import type { DashboardSnapshot } from '../storage/snapshotRepository';
import type { PeriodEventKey, PeriodParticipant } from './analytics';
import { buildParticipantRows, periodEventLabels, serializeParticipantsCsv, snapshotStatusLabel } from './participants';

interface Props {
  event: PeriodEventKey;
  participants: readonly PeriodParticipant[];
  memberSnapshot: DashboardSnapshot | null;
  from: string;
  to: string;
  historyExportDate: string;
  onClose(): void;
}

const dateLabel = (value: string) => value.split('-').reverse().join('.');
const eventDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC',
});

export function PeriodParticipants({ event, participants, memberSnapshot, from, to, historyExportDate, onClose }: Props) {
  const rows = useMemo(() => buildParticipantRows(participants, memberSnapshot?.members ?? []), [participants, memberSnapshot]);
  const missing = rows.filter((row) => row.snapshotStatus === null).length;
  const dateHeading = event === 'left' ? 'Окончание доступа' : event === 'joined' ? 'Первый доступ' : 'Возвращение';

  function download() {
    const csv = serializeParticipantsCsv(rows, {
      event, from, to, historyExportDate, memberExportDate: memberSnapshot?.metadata.exportDate,
    });
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `club-${event}-${from}-${to}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="period-participants" id="period-participants" aria-labelledby="period-participants-heading">
      <header className="period-participants-header">
        <div>
          <h3 id="period-participants-heading">{periodEventLabels[event]} за период</h3>
          <p>{dateLabel(from)}–{dateLabel(to)} · UTC · Всего: {rows.length.toLocaleString('ru-RU')}</p>
        </div>
        <div className="period-participants-actions">
          <button className="upload-button" type="button" disabled={rows.length === 0} onClick={download}>Скачать CSV</button>
          <button className="upload-button" type="button" onClick={onClose}>Закрыть список</button>
        </div>
      </header>
      {event === 'left' ? <p className="period-participants-note">Все, у кого закончился расчётный доступ в выбранные даты, включая тех, кто затем вернулся. Список совпадает с карточкой «Ушедшие».</p> : null}
      {missing > 0 ? (
        <p className="period-participants-note">Без контактов в CSV участников: {missing}. Загрузите актуальный CSV участников кнопкой «Загрузить CSV» вверху страницы. Эти участники сохранены в списке по USER_ID.</p>
      ) : null}
      {rows.length === 0 ? <p className="period-participants-empty">За выбранный период таких участников нет.</p> : (
        <div className="scroll period-participants-scroll" role="region" aria-label="Список участников за период" tabIndex={0}>
          <table aria-label={`${periodEventLabels[event]} за период`}>
            <thead>
              <tr>
                <th>Участник / USER_ID</th>
                <th>Telegram</th>
                <th>Телефон</th>
                <th>{dateHeading} · UTC</th>
                <th>Доступ на конец периода</th>
                <th>Статус в CSV участников</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const username = row.telegram.replace(/^@/, '');
                return (
                  <tr className="member-row" key={row.userId}>
                    <td className="period-person">
                      {row.name ? <><span className="nm">{row.name}</span><span className="period-person-id">{row.userId}</span></> : row.userId}
                    </td>
                    <td className="tg">{username && /^[a-zA-Z0-9_]+$/.test(username)
                      ? <a href={`https://t.me/${username}`} target="_blank" rel="noopener noreferrer">{row.telegram}</a>
                      : row.telegram || <span className="dim">—</span>}</td>
                    <td className="ph">{row.phone || <span className="dim">—</span>}</td>
                    <td>{row.dates.map((date) => <time className="period-event-date" key={date} dateTime={new Date(date).toISOString()}>{eventDateFormatter.format(date)}</time>)}</td>
                    <td><span className={`pill ${row.activeAtEnd ? 'a' : 'c'}`}>{row.activeAtEnd ? 'Есть доступ' : 'Нет доступа'}</span></td>
                    <td>{snapshotStatusLabel(row.snapshotStatus)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <footer className="period-participants-note">
        <p>Доступ на конец периода рассчитан по транзакциям от {dateLabel(historyExportDate)}.</p>
        {memberSnapshot ? <p>Контакты и текущий статус — из CSV участников от {dateLabel(memberSnapshot.metadata.exportDate)}. Этот статус может отличаться от доступа на конец выбранного периода.</p> : null}
      </footer>
    </section>
  );
}
