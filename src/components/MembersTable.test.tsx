import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { MemberRecord } from '../domain/member';
import { MembersTable } from './MembersTable';

afterEach(cleanup);

function member(overrides: Partial<MemberRecord>): MemberRecord {
  return {
    id: 'member',
    name: 'Тестовый участник',
    telegram: '@test_member',
    phone: '+79000000000',
    startedAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-02-01T00:00:00.000Z',
    startedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
    endsAtMs: Date.parse('2026-02-01T00:00:00.000Z'),
    status: 'active',
    plan: '1 месяц 💬',
    paymentCount: 1,
    lifetimeDays: 31,
    recurrent: false,
    ...overrides,
  };
}

const members: MemberRecord[] = [
  member({
    id: 'pavel', name: 'Павел', telegram: '@Pavel_One', phone: '+79990000001',
    startedAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-06-15T00:00:00.000Z',
    startedAtMs: Date.parse('2026-01-01T00:00:00.000Z'), endsAtMs: Date.parse('2026-06-15T00:00:00.000Z'),
    paymentCount: 3, lifetimeDays: 165,
  }),
  member({
    id: 'anna', name: 'Анна', telegram: '@annA', phone: '+79990000002',
    startedAt: '2026-02-10T00:00:00.000Z', endsAt: '2026-05-01T00:00:00.000Z',
    startedAtMs: Date.parse('2026-02-10T00:00:00.000Z'), endsAtMs: Date.parse('2026-05-01T00:00:00.000Z'),
    paymentCount: 1, lifetimeDays: 80,
  }),
  member({
    id: 'boris', name: 'Борис', telegram: '@churned', phone: '+79990000003',
    startedAt: '2026-01-05T00:00:00.000Z', endsAt: '2026-03-03T00:00:00.000Z',
    startedAtMs: Date.parse('2026-01-05T00:00:00.000Z'), endsAtMs: Date.parse('2026-03-03T00:00:00.000Z'),
    status: 'churned', paymentCount: 2, lifetimeDays: 57,
  }),
];

function visibleNames(): string[] {
  const table = screen.getByRole('table', { name: 'Участники' });
  return within(table).getAllByRole('row').slice(1).map((row) => {
    return within(row).getAllByRole('cell')[0].textContent ?? '';
  });
}

describe('MembersTable', () => {
  it('searches Telegram, filters status, and restores all records', async () => {
    const user = userEvent.setup();
    render(<MembersTable members={members} />);

    expect(screen.getByText('3 записи')).toBeInTheDocument();
    expect(visibleNames()).toEqual(['Павел', 'Анна', 'Борис']);

    const search = screen.getByRole('searchbox', { name: 'Поиск участников' });
    await user.type(search, '@pAvEl_OnE');
    expect(visibleNames()).toEqual(['Павел']);
    expect(screen.getByText('1 запись')).toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByRole('tab', { name: 'Активные' }));
    expect(visibleNames()).toEqual(['Павел', 'Анна']);
    expect(screen.queryByText('Борис')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Все' }));
    expect(visibleNames()).toHaveLength(3);
    expect(screen.getByText('3 записи')).toBeInTheDocument();
  });

  it('sorts from the dropdown and toggles Russian name order from the header', async () => {
    const user = userEvent.setup();
    render(<MembersTable members={members} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Сортировка' }), 'paymentCount-desc');
    expect(visibleNames()).toEqual(['Павел', 'Борис', 'Анна']);

    const nameButton = screen.getByRole('button', { name: 'Сортировать по имени' });
    await user.click(nameButton);
    expect(visibleNames()).toEqual(['Павел', 'Борис', 'Анна']);
    expect(nameButton.closest('th')).toHaveAttribute('aria-sort', 'descending');

    await user.click(nameButton);
    expect(visibleNames()).toEqual(['Анна', 'Борис', 'Павел']);
    expect(nameButton.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('formats dates in UTC and exposes accessible status tabs', () => {
    render(<MembersTable members={members} />);

    expect(screen.getByRole('tablist', { name: 'Фильтр по статусу' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Все' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('15.06.2026')).toBeInTheDocument();
    expect(screen.getByText('01.01.2026')).toBeInTheDocument();
  });
});
