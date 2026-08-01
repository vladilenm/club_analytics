import { describe, expect, it } from 'vitest';
import type { MemberRecord } from './member';
import { queryMembers, type MemberQuery } from './queryMembers';

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
  member({
    id: 'alena', name: 'Алёна', telegram: '@long', phone: '+79990000004',
    startedAt: '2026-03-15T00:00:00.000Z', endsAt: '2026-08-30T00:00:00.000Z',
    startedAtMs: Date.parse('2026-03-15T00:00:00.000Z'), endsAtMs: Date.parse('2026-08-30T00:00:00.000Z'),
    status: 'churned', paymentCount: 4, lifetimeDays: 168,
  }),
];

const query: MemberQuery = { search: '', status: 'all', sortKey: 'endsAt', sortDirection: 'desc' };
const ids = (result: MemberRecord[]) => result.map((member) => member.id);

describe('queryMembers', () => {
  it.each([
    ['name', 'пАвЕл', ['pavel']],
    ['Telegram', '  @ANNA ', ['anna']],
    ['phone', '000003', ['boris']],
  ])('searches %s case-insensitively across searchable member fields', (_field, search, expected) => {
    expect(ids(queryMembers(members, { ...query, search }))).toEqual(expected);
  });

  it.each([
    ['all', ['alena', 'pavel', 'anna', 'boris']],
    ['active', ['pavel', 'anna']],
    ['churned', ['alena', 'boris']],
  ] as const)('filters %s members', (status, expected) => {
    expect(ids(queryMembers(members, { ...query, status }))).toEqual(expected);
  });

  it.each([
    ['endsAt', 'desc', ['alena', 'pavel', 'anna', 'boris']],
    ['endsAt', 'asc', ['boris', 'anna', 'pavel', 'alena']],
    ['startedAt', 'asc', ['pavel', 'boris', 'anna', 'alena']],
    ['startedAt', 'desc', ['alena', 'anna', 'boris', 'pavel']],
    ['lifetimeDays', 'desc', ['alena', 'pavel', 'anna', 'boris']],
    ['paymentCount', 'desc', ['alena', 'pavel', 'boris', 'anna']],
    ['name', 'asc', ['alena', 'anna', 'boris', 'pavel']],
    ['telegram', 'asc', ['anna', 'boris', 'alena', 'pavel']],
    ['phone', 'asc', ['pavel', 'anna', 'boris', 'alena']],
    ['status', 'asc', ['pavel', 'anna', 'boris', 'alena']],
  ] as const)('sorts by %s %s', (sortKey, sortDirection, expected) => {
    expect(ids(queryMembers(members, { ...query, sortKey, sortDirection }))).toEqual(expected);
  });

  it('does not mutate the input array while filtering and sorting', () => {
    const input = members;
    const original = [...members];

    queryMembers(members, { ...query, status: 'churned', sortKey: 'name', sortDirection: 'asc' });

    expect(members).toEqual(original);
    expect(members).toBe(input);
  });
});
