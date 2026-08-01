import type { MemberRecord } from './member';

export type StatusFilter = 'all' | 'active' | 'churned';
export type SortKey = 'endsAt' | 'startedAt' | 'lifetimeDays' | 'paymentCount' | 'name' | 'telegram' | 'phone' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface MemberQuery {
  search: string;
  status: StatusFilter;
  sortKey: SortKey;
  sortDirection: SortDirection;
}

function compareMembers(left: MemberRecord, right: MemberRecord, key: SortKey): number {
  switch (key) {
    case 'endsAt':
      return left.endsAtMs - right.endsAtMs;
    case 'startedAt':
      return left.startedAtMs - right.startedAtMs;
    case 'lifetimeDays':
      return left.lifetimeDays - right.lifetimeDays;
    case 'paymentCount':
      return left.paymentCount - right.paymentCount;
    case 'name':
      return left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
    case 'telegram':
      return left.telegram.localeCompare(right.telegram, 'ru', { sensitivity: 'base' });
    case 'phone':
      return left.phone.localeCompare(right.phone, 'ru', { sensitivity: 'base' });
    case 'status':
      return left.status.localeCompare(right.status, 'ru', { sensitivity: 'base' });
  }
}

export function queryMembers(
  members: readonly MemberRecord[],
  query: MemberQuery,
): MemberRecord[] {
  const search = query.search.trim().toLocaleLowerCase('ru');
  const direction = query.sortDirection === 'asc' ? 1 : -1;

  return members
    .filter((member) => {
      if (query.status !== 'all' && member.status !== query.status) return false;
      if (search === '') return true;

      return [member.name, member.telegram, member.phone]
        .some((field) => field.toLocaleLowerCase('ru').includes(search));
    })
    .sort((left, right) => direction * compareMembers(left, right, query.sortKey));
}
