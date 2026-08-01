import { buildInsight, type DashboardModel } from '../domain/analytics';

export interface InsightProps {
  model: DashboardModel;
}

export function Insight({ model }: InsightProps) {
  return (
    <aside className="ins" aria-label="Главный вывод">
      <strong>Главное:</strong>{' '}
      {buildInsight(model)}
    </aside>
  );
}
