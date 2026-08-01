import { describe, expect, it } from 'vitest';
import type { MemberRecord } from '../domain/member';
import {
  createSnapshotRepository,
  type DashboardSnapshot,
  type KeyValueAdapter,
} from './snapshotRepository';

function createMemoryAdapter(): KeyValueAdapter {
  const values = new Map<string, unknown>();

  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    del: async (key) => {
      values.delete(key);
    },
  };
}

const snapshot: DashboardSnapshot = {
  schemaVersion: 1,
  members: [
    {
      id: '1',
      name: 'Ирина',
      telegram: '@irina',
      phone: '+79990000000',
      startedAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-02-01T00:00:00.000Z',
      startedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
      endsAtMs: Date.parse('2026-02-01T00:00:00.000Z'),
      status: 'active',
      plan: '1 месяц',
      paymentCount: 1,
      lifetimeDays: 31,
      recurrent: false,
    } satisfies MemberRecord,
  ],
  metadata: {
    fileName: 'members.csv',
    exportDate: '2026-01-01',
    importedAt: '2026-01-02T12:00:00.000Z',
  },
};

interface MutableSnapshot {
  schemaVersion: unknown;
  members: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

function invalidSnapshot(mutate: (value: MutableSnapshot) => void): unknown {
  const value = structuredClone(snapshot) as unknown as MutableSnapshot;
  mutate(value);
  return value;
}

async function expectInvalidSnapshot(value: unknown): Promise<void> {
  const adapter = createMemoryAdapter();
  const repository = createSnapshotRepository(adapter);
  await adapter.set('analytics-club/latest-snapshot', value);

  await expect(repository.load()).resolves.toBeNull();
}

describe('SnapshotRepository', () => {
  it('saves, loads, and clears the latest snapshot', async () => {
    const repository = createSnapshotRepository(createMemoryAdapter());

    await repository.save(snapshot);
    expect(await repository.load()).toEqual(snapshot);

    await repository.clear();
    expect(await repository.load()).toBeNull();
  });

  it('returns null for an unsupported schema version', async () => {
    const adapter = createMemoryAdapter();
    const repository = createSnapshotRepository(adapter);

    await adapter.set('analytics-club/latest-snapshot', { schemaVersion: 999 });

    expect(await repository.load()).toBeNull();
  });

  it('returns null for incomplete version-1 data', async () => {
    const adapter = createMemoryAdapter();
    const repository = createSnapshotRepository(adapter);

    await adapter.set('analytics-club/latest-snapshot', {
      schemaVersion: 1,
      members: [],
      metadata: { fileName: 'members.csv', exportDate: '2026-01-01' },
    });

    expect(await repository.load()).toBeNull();
  });

  it.each([
    ['an empty member array', (value: MutableSnapshot) => { value.members = []; }],
    ['an empty member id', (value: MutableSnapshot) => { value.members[0].id = '   '; }],
    ['a non-normalized member id', (value: MutableSnapshot) => { value.members[0].id = ' 1 '; }],
    ['duplicate member ids', (value: MutableSnapshot) => { value.members.push(structuredClone(value.members[0])); }],
    ['a non-string name', (value: MutableSnapshot) => { value.members[0].name = 7; }],
    ['a non-string Telegram handle', (value: MutableSnapshot) => { value.members[0].telegram = null; }],
    ['a non-string phone', (value: MutableSnapshot) => { value.members[0].phone = true; }],
    ['a non-string plan', (value: MutableSnapshot) => { value.members[0].plan = []; }],
    ['an unsupported status', (value: MutableSnapshot) => { value.members[0].status = 'paused'; }],
    ['a non-boolean recurrent flag', (value: MutableSnapshot) => { value.members[0].recurrent = 'false'; }],
    ['a non-finite start timestamp', (value: MutableSnapshot) => { value.members[0].startedAtMs = Number.NaN; }],
    ['a non-finite end timestamp', (value: MutableSnapshot) => { value.members[0].endsAtMs = Number.POSITIVE_INFINITY; }],
    ['a non-normalized start ISO string', (value: MutableSnapshot) => { value.members[0].startedAt = '2026-01-01T00:00:00Z'; }],
    ['a start ISO string inconsistent with its timestamp', (value: MutableSnapshot) => {
      value.members[0].startedAtMs = Date.parse('2026-01-01T00:00:00.000Z') + 1;
    }],
    ['an end ISO string inconsistent with its timestamp', (value: MutableSnapshot) => { value.members[0].endsAt = '2026-02-02T00:00:00.000Z'; }],
    ['an end before the start', (value: MutableSnapshot) => {
      value.members[0].endsAt = '2025-12-31T00:00:00.000Z';
      value.members[0].endsAtMs = Date.parse('2025-12-31T00:00:00.000Z');
    }],
    ['a zero payment count', (value: MutableSnapshot) => { value.members[0].paymentCount = 0; }],
    ['an unsafe payment count', (value: MutableSnapshot) => { value.members[0].paymentCount = Number.MAX_SAFE_INTEGER + 1; }],
    ['a fractional payment count', (value: MutableSnapshot) => { value.members[0].paymentCount = 1.5; }],
    ['a negative lifetime', (value: MutableSnapshot) => { value.members[0].lifetimeDays = -1; }],
    ['a fractional lifetime', (value: MutableSnapshot) => { value.members[0].lifetimeDays = 31.5; }],
    ['a lifetime inconsistent with its dates', (value: MutableSnapshot) => { value.members[0].lifetimeDays = 30; }],
  ])('returns null for %s', async (_label, mutate) => {
    await expectInvalidSnapshot(invalidSnapshot(mutate));
  });

  it.each([
    ['an empty file name', (value: MutableSnapshot) => { value.metadata.fileName = '  '; }],
    ['a non-string file name', (value: MutableSnapshot) => { value.metadata.fileName = 123; }],
    ['a non-CSV file name', (value: MutableSnapshot) => { value.metadata.fileName = 'members.txt'; }],
    ['an impossible export date', (value: MutableSnapshot) => { value.metadata.exportDate = '2026-02-30'; }],
    ['a non-canonical export date', (value: MutableSnapshot) => { value.metadata.exportDate = '2026-2-01'; }],
    ['a non-string export date', (value: MutableSnapshot) => { value.metadata.exportDate = null; }],
    ['an invalid import timestamp', (value: MutableSnapshot) => { value.metadata.importedAt = 'not-a-date'; }],
    ['a non-normalized import timestamp', (value: MutableSnapshot) => { value.metadata.importedAt = '2026-01-02T15:00:00+03:00'; }],
    ['a non-string import timestamp', (value: MutableSnapshot) => { value.metadata.importedAt = 0; }],
  ])('returns null for metadata with %s', async (_label, mutate) => {
    await expectInvalidSnapshot(invalidSnapshot(mutate));
  });
});
