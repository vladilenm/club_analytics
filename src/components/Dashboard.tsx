import type { DashboardModel } from '../domain/analytics';
import type { MemberRecord } from '../domain/member';
import { ActivityChart } from './ActivityChart';
import { Insight } from './Insight';
import { KpiGrid } from './KpiGrid';
import { MembersTable } from './MembersTable';
import { PlanDistribution } from './PlanDistribution';

export interface DashboardProps {
  members: readonly MemberRecord[];
  model: DashboardModel;
}

export function Dashboard({ members, model }: DashboardProps) {
  return (
    <section aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading">Дашборд участников</h2>
      <KpiGrid stats={model.stats} />
      <Insight model={model} />
      <div className="grid">
        <ActivityChart months={model.months} />
        <PlanDistribution plans={model.activePlans} />
      </div>
      <MembersTable members={members} />
    </section>
  );
}
