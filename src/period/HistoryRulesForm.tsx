import { useState } from 'react';
import { isHistoryRules, type Duration, type HistoryRules } from './model';

interface Props {
  plans: readonly string[];
  rules: HistoryRules;
  busy: boolean;
  onSave(rules: HistoryRules): Promise<void>;
}

export function HistoryRulesForm({ plans, rules, busy, onSave }: Props) {
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const durations = Object.fromEntries(plans.map((plan, index) => [plan, {
      count: Number(data.get(`duration-${index}`)), unit: data.get(`unit-${index}`),
    } as Duration]));
    const next = {
      durations, renewal: data.get('renewal'), gapHours: Number(data.get('gapHours')),
    };
    if (!isHistoryRules(next)) { setError('Укажите положительный срок каждого тарифа.'); return; }
    setError(null);
    void onSave(next);
  }

  const missingPlan = plans.some((plan) => !Object.hasOwn(rules.durations, plan));

  return (
    <details className="history-rules" open={missingPlan || undefined}>
      <summary>Правила расчёта и сроки тарифов</summary>
      <p>История не содержит дат окончания доступа. Эти настройки определяют расчёт. Измените их, если правила бота отличаются.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="history-rule-options">
            <label>При продлении
              <select name="renewal" aria-label="При продлении" defaultValue={rules.renewal}>
                <option value="payment">Новый срок от даты оплаты</option>
                <option value="remaining">Добавить к оставшемуся доступу</option>
              </select>
            </label>
            <label>Объединять перерывы до, часов
              <input name="gapHours" type="number" min="0" max="168" step="0.5" required defaultValue={rules.gapHours} />
            </label>
          </div>
          <p>При значении 0 любой перерыв считается уходом и возвращением. Увеличьте допуск, если бот продлевает доступ с технической задержкой.</p>
          <div className="history-plan-settings">
            {plans.map((plan, index) => (
              <div className="history-plan-setting" key={plan}>
                <label htmlFor={`duration-${index}`}>{plan}</label>
                <input id={`duration-${index}`} name={`duration-${index}`} type="number" min="1" max="1200" step="1" required defaultValue={rules.durations[plan]?.count ?? ''} />
                <select name={`unit-${index}`} aria-label={`Единица срока: ${plan}`} defaultValue={rules.durations[plan]?.unit ?? 'months'}>
                  <option value="months">мес.</option><option value="days">дн.</option>
                </select>
              </div>
            ))}
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <button className="upload-button" type="submit">Применить правила</button>
        </fieldset>
      </form>
    </details>
  );
}
