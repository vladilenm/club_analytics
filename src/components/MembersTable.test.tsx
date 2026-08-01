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

  it('keeps the sort dropdown truthful after header sorting and accepts the next dropdown sort', async () => {
    const user = userEvent.setup();
    render(<MembersTable members={members} />);

    const sort = screen.getByRole('combobox', { name: 'Сортировка' });
    await user.click(screen.getByRole('button', { name: 'Сортировать по имени' }));

    expect(sort).toHaveValue('name-desc');
    expect(within(sort).getByRole('option', { name: 'Имя Я→А' })).toBeDisabled();
    expect(visibleNames()).toEqual(['Павел', 'Борис', 'Анна']);

    await user.selectOptions(sort, 'paymentCount-desc');
    expect(sort).toHaveValue('paymentCount-desc');
    expect(visibleNames()).toEqual(['Павел', 'Борис', 'Анна']);
  });

  it.each([
    ['Telegram', 'Сортировать по Telegram', 'telegram-desc', ['Павел', 'Борис', 'Анна'], ['Анна', 'Борис', 'Павел']],
    ['phone', 'Сортировать по телефону', 'phone-desc', ['Борис', 'Анна', 'Павел'], ['Павел', 'Анна', 'Борис']],
    ['status', 'Сортировать по статусу', 'status-desc', ['Борис', 'Павел', 'Анна'], ['Павел', 'Анна', 'Борис']],
  ])('sorts from the legacy %s header and keeps the dropdown truthful', async (_column, buttonName, sortValue, expectedDesc, expectedAsc) => {
    const user = userEvent.setup();
    render(<MembersTable members={members} />);

    const sort = screen.getByRole('combobox', { name: 'Сортировка' });
    const header = screen.getByRole('button', { name: buttonName });
    await user.click(header);

    expect(visibleNames()).toEqual(expectedDesc);
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'descending');
    expect(sort).toHaveValue(sortValue);
    expect(within(sort).getByRole('option', { selected: true })).toBeDisabled();

    await user.click(header);
    expect(visibleNames()).toEqual(expectedAsc);
    expect(header.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('implements roving keyboard tabs tied to a named tabpanel', async () => {
    const user = userEvent.setup();
    render(<MembersTable members={members} />);

    const all = screen.getByRole('tab', { name: 'Все' });
    const active = screen.getByRole('tab', { name: 'Активные' });
    const churned = screen.getByRole('tab', { name: 'Отменившие' });

    expect(all).toHaveAttribute('tabindex', '0');
    expect(active).toHaveAttribute('tabindex', '-1');
    expect(churned).toHaveAttribute('tabindex', '-1');
    for (const tab of [all, active, churned]) {
      expect(tab).toHaveAttribute('aria-controls', 'members-panel');
    }
    expect(screen.getByRole('tabpanel', { name: 'Все' })).toHaveAttribute('aria-labelledby', 'status-tab-all');

    all.focus();
    await user.keyboard('{ArrowRight}');
    expect(active).toHaveFocus();
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tabpanel', { name: 'Активные' })).toHaveAttribute('aria-labelledby', 'status-tab-active');
    expect(visibleNames()).toEqual(['Павел', 'Анна']);

    await user.keyboard('{End}');
    expect(churned).toHaveFocus();
    expect(churned).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(all).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(churned).toHaveFocus();
    await user.keyboard('{Home}');
    expect(all).toHaveFocus();
    expect(all).toHaveAttribute('aria-selected', 'true');
  });

  it('formats dates in UTC and exposes accessible status tabs', () => {
    render(<MembersTable members={members} />);

    expect(screen.getByRole('tablist', { name: 'Фильтр по статусу' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Все' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('15.06.2026')).toBeInTheDocument();
    expect(screen.getByText('01.01.2026')).toBeInTheDocument();
  });
});
