import { describe, expect, it } from 'vitest';
import { ImportError } from '../domain/importError';
import type { MemberRecord } from '../domain/member';
import { makeCsv, makeRawMember } from '../test/csvFixture';
import {
  createSnapshotRepository,
  type DashboardSnapshot,
  type KeyValueAdapter,
} from '../storage/snapshotRepository';
import { importCsvFile, resolveExportDate } from './importCsvFile';

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

const existingSnapshot: DashboardSnapshot = {
  schemaVersion: 1,
  members: [{
    id: 'existing',
    name: 'Existing Member',
    telegram: '@existing',
    phone: '+79990000000',
    startedAt: '2026-07-01T00:00:00.000Z',
    endsAt: '2026-08-01T00:00:00.000Z',
    startedAtMs: Date.parse('2026-07-01T00:00:00.000Z'),
    endsAtMs: Date.parse('2026-08-01T00:00:00.000Z'),
    status: 'active',
    plan: 'monthly',
    paymentCount: 1,
    lifetimeDays: 31,
    recurrent: false,
  } satisfies MemberRecord],
  metadata: {
    fileName: 'existing.csv',
    exportDate: '2026-08-01',
    importedAt: '2026-08-01T10:00:00.000Z',
  },
};

describe('importCsvFile', () => {
  it('imports, dates, and persists a valid CSV before returning it', async () => {
    const repository = createSnapshotRepository(createMemoryAdapter());
    const file = new File([makeCsv([makeRawMember()])], 'members-2026-08-01.csv', { type: 'text/csv' });

    const snapshot = await importCsvFile(file, repository, () => new Date('2026-08-02T10:00:00Z'));

    expect(snapshot.metadata).toEqual({
      fileName: 'members-2026-08-01.csv',
      exportDate: '2026-08-01',
      importedAt: '2026-08-02T10:00:00.000Z',
    });
    expect(await repository.load()).toEqual(snapshot);
  });

  it('does not replace the repository after an invalid import', async () => {
    const repository = createSnapshotRepository(createMemoryAdapter());
    await repository.save(existingSnapshot);
    const file = new File(['bad'], 'members.csv', { type: 'text/csv' });

    await expect(importCsvFile(file, repository)).rejects.toBeInstanceOf(ImportError);

    expect(await repository.load()).toEqual(existingSnapshot);
  });

  it('rejects a non-CSV filename before reading it', async () => {
    const repository = createSnapshotRepository(createMemoryAdapter());
    const file = new File([makeCsv([makeRawMember()])], 'members.txt', { type: 'text/plain' });

    await expect(importCsvFile(file, repository)).rejects.toMatchObject({ code: 'NOT_CSV' });
  });

  it('rejects invalid UTF-8 bytes', async () => {
    const repository = createSnapshotRepository(createMemoryAdapter());
    const file = new File([new Uint8Array([0xc3, 0x28])], 'members.csv', { type: 'text/csv' });

    await expect(importCsvFile(file, repository)).rejects.toMatchObject({ code: 'INVALID_ENCODING' });
  });

  it('maps file-read failures separately', async () => {
    const repository = createSnapshotRepository(createMemoryAdapter());
    const file = {
      name: 'members.csv',
      arrayBuffer: async () => Promise.reject(new Error('cannot read')),
    } as File;

    await expect(importCsvFile(file, repository)).rejects.toMatchObject({ code: 'UNREADABLE_FILE' });
  });

  it('uses the injected local date when a filename has no valid date token', () => {
    expect(resolveExportDate('members-2026-02-30.csv', new Date('2026-08-02T10:00:00Z'))).toBe('2026-08-02');
    expect(resolveExportDate('members.csv', new Date('2026-08-02T10:00:00Z'))).toBe('2026-08-02');
  });
});
