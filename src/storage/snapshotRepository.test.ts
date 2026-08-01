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
});
