import type { MonthPoint } from '../domain/analytics';

export interface ActivityChartProps {
  months: readonly MonthPoint[];
}

const shortMonthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  timeZone: 'UTC',
});

const longMonthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  timeZone: 'UTC',
});

function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase('ru') + value.slice(1);
}

function cancellationWord(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'отмен';
  if (last === 1) return 'отмена';
  if (last >= 2 && last <= 4) return 'отмены';
  return 'отмен';
}

export function ActivityChart({ months }: ActivityChartProps) {
  let maximum = 0;
  for (const point of months) {
    if (point.joins > maximum) maximum = point.joins;
    if (point.churn > maximum) maximum = point.churn;
  }

  return (
    <section className="card" aria-labelledby="activity-heading">
      <h3 id="activity-heading">Приток / отток по месяцам</h3>
      {months.length === 0 ? <p>Нет данных по месяцам.</p> : (
        <div className="bars" role="list" aria-label="Приток и отток">
          {months.map((point) => {
            const date = monthDate(point.month);
            const fullLabel = `${capitalize(longMonthFormatter.format(date))} ${point.month.slice(0, 4)}: ${point.joins} новых, ${point.churn} ${cancellationWord(point.churn)}`;
            const joinsHeight = maximum === 0 ? 0 : point.joins / maximum * 100;
            const churnHeight = maximum === 0 ? 0 : point.churn / maximum * 100;

            return (
              <div className="bg" role="listitem" key={point.month}>
                <span className="sr-only">{fullLabel}</span>
                <div className="pair" aria-hidden="true">
                  <span className="bar in" style={{ height: `${joinsHeight}%` }}>
                    <span className="bv">{point.joins}</span>
                  </span>
                  <span className="bar out" style={{ height: `${churnHeight}%` }}>
                    <span className="bv">{point.churn}</span>
                  </span>
                </div>
                <span className="bl" aria-hidden="true">{shortMonthFormatter.format(date)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="leg" aria-hidden="true">
        <span><i className="dot active" />Новые подписки</span>
        <span><i className="dot churned" />Отмены</span>
      </div>
    </section>
  );
}
