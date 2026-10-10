import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { parseMembersCsv } from '../domain/csv/parseMembersCsv';
import type { DashboardSnapshot } from '../storage/snapshotRepository';
import { makeCsv, makeRawMember } from '../test/csvFixture';
import { HistoryReport } from './HistoryReport';
import { createRules, type Transaction } from './model';
import type { HistorySnapshot } from './repository';

afterEach(cleanup);

const transactions: Transaction[] = [
  ...Array.from({ length: 9 }, (_, index) => ({ userId: `person-${index}`, paidAt: '2026-09-03T00:00:00.000Z', plan: 'Старт' })),
  ...Array.from({ length: 6 }, (_, index) => ({ userId: `person-${index}`, paidAt: '2026-10-05T00:00:00.000Z', plan: 'Старт' })),
  { userId: 'new', paidAt: '2026-10-06T00:00:00.000Z', plan: 'Старт' },
];
const snapshot: HistorySnapshot = {
  schemaVersion: 1, transactions, rules: createRules(transactions),
  metadata: { fileName: 'history-2026-10-07.csv', exportDate: '2026-10-07', importedAt: '2026-10-07T12:00:00.000Z' },
};
const memberSnapshot: DashboardSnapshot = {
  schemaVersion: 1,
  members: parseMembersCsv(makeCsv([
    ...Array.from({ length: 9 }, (_, index) => makeRawMember({
      USER_ID: `person-${index}`, name: `Участник ${index}`, username: `test_person_${index}`, active: index < 6 ? '1' : '0',
    })),
    makeRawMember({ USER_ID: 'new', name: 'Новый участник', username: 'test_new' }),
  ])),
  metadata: { fileName: 'members-2026-10-07.csv', exportDate: '2026-10-07', importedAt: '2026-10-07T13:00:00.000Z' },
};
const onSaveRules = async () => {};
const cohort = (title = 'Ушедшие за период') => screen.getByRole('region', { name: title });
const rows = (title?: string) => within(cohort(title)).getAllByRole('row').slice(1);

describe('HistoryReport participant lists', () => {
  it('opens the exact departures, new members and early returns with their contacts', async () => {
    const user = userEvent.setup();
    render(<HistoryReport snapshot={snapshot} memberSnapshot={memberSnapshot} busy={false} onSaveRules={onSaveRules} />);
    await user.click(screen.getByRole('button', { name: 'Ушедшие: 9 — показать участников' }));
    expect(rows()).toHaveLength(9);
    expect(within(cohort()).getAllByText('Активен', { exact: true })).toHaveLength(6);
    expect(within(cohort()).getAllByText('Отменил', { exact: true })).toHaveLength(3);
    expect(within(cohort()).getByRole('link', { name: '@test_person_0' })).toHaveAttribute('href', 'https://t.me/test_person_0');
    expect(screen.getByRole('button', { name: 'Ушедшие: 9 — показать участников' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(cohort()).getByRole('button', { name: 'Скачать CSV' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Новые: 1 — показать участников' }));
    expect(rows('Новые за период')).toHaveLength(1);
    expect(within(cohort('Новые за период')).getByText('Новый участник')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Вернувшиеся: 6 — показать участников' }));
    expect(rows('Вернувшиеся за период')).toHaveLength(6);
    expect(screen.getByText(/Возвращение раньше 30 дней тоже учитывается/)).toBeInTheDocument();
  });

  it('updates the opened list on date changes and hides it for an invalid range', async () => {
    const user = userEvent.setup();
    render(<HistoryReport snapshot={snapshot} busy={false} onSaveRules={onSaveRules} />);
    await user.click(screen.getByRole('button', { name: 'Ушедшие: 9 — показать участников' }));
    fireEvent.change(screen.getByLabelText('С', { exact: true }), { target: { value: '2026-10-04' } });
    expect(within(cohort()).getByText('За выбранный период таких участников нет.')).toBeInTheDocument();
    expect(within(cohort()).getByRole('button', { name: 'Скачать CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ушедшие: 0 — показать участников' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByLabelText('С', { exact: true }), { target: { value: '2026-10-08' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Начало периода должно быть не позже конца.');
    expect(screen.queryByRole('region', { name: 'Ушедшие за период' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ушедшие: — — показать участников' })).toBeDisabled();
  });

  it('keeps every USER_ID without contacts and refreshes contacts after a member import', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HistoryReport snapshot={snapshot} busy={false} onSaveRules={onSaveRules} />);
    await user.click(screen.getByRole('button', { name: 'Ушедшие: 9 — показать участников' }));
    expect(rows()).toHaveLength(9);
    expect(within(cohort()).getAllByText('Нет в CSV', { exact: true })).toHaveLength(9);
    expect(within(cohort()).getByText('person-8', { exact: true })).toBeInTheDocument();
    rerender(<HistoryReport snapshot={snapshot} memberSnapshot={memberSnapshot} busy={false} onSaveRules={onSaveRules} />);
    expect(rows()).toHaveLength(9);
    expect(within(cohort()).getByText('Участник 8')).toBeInTheDocument();
    expect(within(cohort()).queryByText('Нет в CSV', { exact: true })).not.toBeInTheDocument();
  });

  it('updates an opened list when technical gap rules change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HistoryReport snapshot={snapshot} busy={false} onSaveRules={onSaveRules} />);
    await user.click(screen.getByRole('button', { name: 'Вернувшиеся: 6 — показать участников' }));
    const continuous = { ...snapshot, rules: { ...snapshot.rules, gapHours: 72 } };
    rerender(<HistoryReport snapshot={continuous} busy={false} onSaveRules={onSaveRules} />);
    expect(within(cohort('Вернувшиеся за период')).getByText('За выбранный период таких участников нет.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вернувшиеся: 0 — показать участников' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('supports keyboard activation and restores focus when the list closes', async () => {
    const user = userEvent.setup();
    render(<HistoryReport snapshot={snapshot} busy={false} onSaveRules={onSaveRules} />);
    const button = screen.getByRole('button', { name: 'Ушедшие: 9 — показать участников' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(rows()).toHaveLength(9);
    await user.click(within(cohort()).getByRole('button', { name: 'Закрыть список' }));
    expect(screen.queryByRole('region', { name: 'Ушедшие за период' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
