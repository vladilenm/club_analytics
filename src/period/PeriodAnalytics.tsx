import { useRef } from 'react';
import { HistoryReport } from './HistoryReport';
import { historyRepository, type HistoryRepository } from './repository';
import { useHistory } from './useHistory';

export function PeriodAnalytics({ repository = historyRepository }: { repository?: HistoryRepository }) {
  const { snapshot, busy, error, upload, saveRules } = useHistory(repository);
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="period-section" aria-labelledby="period-heading" aria-busy={busy}>
      <div className="period-header">
        <div>
          <h2 id="period-heading">Показатели за период</h2>
          <p>Расчётные показатели по транзакциям</p>
        </div>
        <button className="upload-button" disabled={busy} onClick={() => input.current?.click()}>Загрузить транзакции</button>
        <input ref={input} type="file" accept=".csv,text/csv" aria-label="CSV транзакций" hidden disabled={busy} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void upload(file);
        }} />
      </div>
      {error ? <p className="period-error" role="alert">{error}</p> : null}
      {busy ? <p className="period-loading">Загрузка истории…</p> : null}
      {snapshot ? <HistoryReport key={snapshot.metadata.importedAt} snapshot={snapshot} busy={busy} onSaveRules={saveRules} /> : (
        <p className="period-empty">Загрузите полную выгрузку транзакций за всё время, чтобы увидеть состав клуба, новых, ушедших и вернувшихся за выбранные даты. История хранится только в этом браузере.</p>
      )}
    </section>
  );
}
