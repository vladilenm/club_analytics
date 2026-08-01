import { useDeferredValue, useMemo, useRef, useState } from 'react';
import type { MemberRecord } from '../domain/member';
import {
  queryMembers,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from '../domain/queryMembers';

export interface MembersTableProps {
  members: readonly MemberRecord[];
}

interface SortableHeaderProps {
  activeDirection: SortDirection | null;
  buttonLabel: string;
  children: React.ReactNode;
  onClick(): void;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const sortOptions: Array<{ value: `${SortKey}-${SortDirection}`; label: string }> = [
  { value: 'endsAt-desc', label: 'Дата окончания ↓' },
  { value: 'endsAt-asc', label: 'Дата окончания ↑' },
  { value: 'startedAt-asc', label: 'Дата старта ↑' },
  { value: 'startedAt-desc', label: 'Дата старта ↓' },
  { value: 'lifetimeDays-desc', label: 'Дольше всех в клубе' },
  { value: 'paymentCount-desc', label: 'Больше платежей' },
  { value: 'name-asc', label: 'Имя А→Я' },
];

const statusTabs: ReadonlyArray<{ status: StatusFilter; label: string }> = [
  { status: 'all', label: 'Все' },
  { status: 'active', label: 'Активные' },
  { status: 'churned', label: 'Отменившие' },
];

function sortLabel(key: SortKey, direction: SortDirection): string {
  switch (key) {
    case 'endsAt':
      return `Дата окончания ${direction === 'asc' ? '↑' : '↓'}`;
    case 'startedAt':
      return `Дата старта ${direction === 'asc' ? '↑' : '↓'}`;
    case 'lifetimeDays':
      return direction === 'desc' ? 'Дольше всех в клубе' : 'Меньше дней в клубе';
    case 'paymentCount':
      return direction === 'desc' ? 'Больше платежей' : 'Меньше платежей';
    case 'name':
      return direction === 'asc' ? 'Имя А→Я' : 'Имя Я→А';
    case 'telegram':
      return `Telegram ${direction === 'asc' ? 'А→Я' : 'Я→А'}`;
    case 'phone':
      return `Телефон ${direction === 'asc' ? '↑' : '↓'}`;
    case 'status':
      return `Статус ${direction === 'asc' ? 'А→Я' : 'Я→А'}`;
  }
}

function SortableHeader({ activeDirection, buttonLabel, children, onClick }: SortableHeaderProps) {
  return (
    <th aria-sort={activeDirection ? (activeDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" aria-label={buttonLabel} onClick={onClick}>{children}</button>
    </th>
  );
}

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

function recordCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} записей`;
  if (last === 1) return `${count} запись`;
  if (last >= 2 && last <= 4) return `${count} записи`;
  return `${count} записей`;
}

export function MembersTable({ members }: MembersTableProps) {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<StatusFilter>('all');
  const statusTabRefs = useRef<Record<StatusFilter, HTMLButtonElement | null>>({
    all: null,
    active: null,
    churned: null,
  });
  const [sortKey, setSortKey] = useState<SortKey>('endsAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const selectedSortValue: `${SortKey}-${SortDirection}` = `${sortKey}-${sortDirection}`;
  const isLegacySortOption = sortOptions.some((option) => option.value === selectedSortValue);
  const visibleMembers = useMemo(() => queryMembers(members, {
    search: deferredSearch,
    status,
    sortKey,
    sortDirection,
  }), [deferredSearch, members, sortDirection, sortKey, status]);

  function selectStatus(nextStatus: StatusFilter): void {
    setStatus(nextStatus);
  }

  function handleStatusKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentStatus: StatusFilter): void {
    const currentIndex = statusTabs.findIndex((tab) => tab.status === currentStatus);
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % statusTabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + statusTabs.length) % statusTabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = statusTabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextStatus = statusTabs[nextIndex].status;
    selectStatus(nextStatus);
    statusTabRefs.current[nextStatus]?.focus();
  }

  function changeSort(event: React.ChangeEvent<HTMLSelectElement>): void {
    const [nextKey, nextDirection] = event.currentTarget.value.split('-') as [SortKey, SortDirection];
    setSortKey(nextKey);
    setSortDirection(nextDirection);
  }

  function sortBy(nextKey: SortKey): void {
    if (nextKey === sortKey) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(nextKey);
    setSortDirection('desc');
  }

  function activeDirection(key: SortKey): SortDirection | null {
    return key === sortKey ? sortDirection : null;
  }

  return (
    <>
      <div className="ctl">
        <input
          type="search"
          aria-label="Поиск участников"
          placeholder="Поиск: имя, @ник, телефон…"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <div className="tabs" role="tablist" aria-label="Фильтр по статусу">
          {statusTabs.map((tab) => (
            <button
              key={tab.status}
              ref={(element) => { statusTabRefs.current[tab.status] = element; }}
              id={`status-tab-${tab.status}`}
              type="button"
              role="tab"
              aria-controls="members-panel"
              aria-selected={status === tab.status}
              tabIndex={status === tab.status ? 0 : -1}
              onClick={() => selectStatus(tab.status)}
              onKeyDown={(event) => handleStatusKeyDown(event, tab.status)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Сортировка"
          value={selectedSortValue}
          onChange={changeSort}
        >
          {isLegacySortOption ? null : (
            <option value={selectedSortValue} disabled>{sortLabel(sortKey, sortDirection)}</option>
          )}
          {sortOptions.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <section
        className="tblwrap"
        id="members-panel"
        role="tabpanel"
        aria-labelledby={`status-tab-${status}`}
        tabIndex={0}
      >
        <div className="thead">
          <h3 id="members-heading">Участники</h3>
          <span className="cnt" aria-live="polite">{recordCountLabel(visibleMembers.length)}</span>
        </div>
        <div className="scroll" role="region" aria-label="Таблица участников" tabIndex={0}>
          <table aria-label="Участники">
            <thead>
              <tr>
                <SortableHeader activeDirection={activeDirection('name')} buttonLabel="Сортировать по имени" onClick={() => sortBy('name')}>Имя</SortableHeader>
                <SortableHeader activeDirection={activeDirection('telegram')} buttonLabel="Сортировать по Telegram" onClick={() => sortBy('telegram')}>Telegram</SortableHeader>
                <SortableHeader activeDirection={activeDirection('phone')} buttonLabel="Сортировать по телефону" onClick={() => sortBy('phone')}>Телефон</SortableHeader>
                <SortableHeader activeDirection={activeDirection('startedAt')} buttonLabel="Сортировать по дате старта" onClick={() => sortBy('startedAt')}>Оформлена</SortableHeader>
                <SortableHeader activeDirection={activeDirection('endsAt')} buttonLabel="Сортировать по дате окончания" onClick={() => sortBy('endsAt')}>Окончание / отмена</SortableHeader>
                <SortableHeader activeDirection={activeDirection('lifetimeDays')} buttonLabel="Сортировать по дням в клубе" onClick={() => sortBy('lifetimeDays')}>Дней</SortableHeader>
                <SortableHeader activeDirection={activeDirection('paymentCount')} buttonLabel="Сортировать по платежам" onClick={() => sortBy('paymentCount')}>Платежей</SortableHeader>
                <SortableHeader activeDirection={activeDirection('status')} buttonLabel="Сортировать по статусу" onClick={() => sortBy('status')}>Статус</SortableHeader>
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => (
                <tr className="member-row" key={member.id}>
                  <td className="nm">{member.name}</td>
                  <td className="tg">{member.telegram || <span className="dim">—</span>}</td>
                  <td className="ph">{member.phone || <span className="dim">—</span>}</td>
                  <td>{formatDate(member.startedAtMs)}</td>
                  <td>{formatDate(member.endsAtMs)}</td>
                  <td>{member.lifetimeDays}</td>
                  <td>{member.paymentCount}</td>
                  <td><span className={`pill ${member.status === 'active' ? 'a' : 'c'}`}>{member.status === 'active' ? 'Активен' : 'Отменил'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
