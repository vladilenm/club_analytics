import type { PlanPoint } from '../domain/analytics';

export interface PlanDistributionProps {
  plans: readonly PlanPoint[];
}

export function PlanDistribution({ plans }: PlanDistributionProps) {
  let total = 0;
  for (const plan of plans) total += plan.count;

  return (
    <section className="card" aria-labelledby="plans-heading">
      <h3 id="plans-heading">Тарифы активных участников</h3>
      {total === 0 ? <p>Нет активных тарифов.</p> : (
        <ul className="plans">
          {plans.map((plan) => (
            <li className="plan" key={plan.plan}>
              <span className="pn">{plan.plan}</span>
              <span className="ptrack" aria-hidden="true">
                <span className="pfill" style={{ width: `${plan.count / total * 100}%` }} />
              </span>
              <span className="pv">{plan.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
