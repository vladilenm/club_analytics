import { del, get, set } from 'idb-keyval';
import type { MemberRecord } from '../domain/member';

const SNAPSHOT_KEY = 'analytics-club/latest-snapshot';

export interface ImportMetadata {
  fileName: string;
  exportDate: string;
  importedAt: string;
}

export interface DashboardSnapshot {
  schemaVersion: 1;
  members: MemberRecord[];
  metadata: ImportMetadata;
}

export interface KeyValueAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export interface SnapshotRepository {
  load(): Promise<DashboardSnapshot | null>;
  save(snapshot: DashboardSnapshot): Promise<void>;
  clear(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isImportMetadata(value: unknown): value is ImportMetadata {
  return isRecord(value)
    && typeof value.fileName === 'string'
    && typeof value.exportDate === 'string'
    && typeof value.importedAt === 'string';
}

function isDashboardSnapshot(value: unknown): value is DashboardSnapshot {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.members)
    && isImportMetadata(value.metadata);
}

export function createSnapshotRepository(adapter: KeyValueAdapter): SnapshotRepository {
  return {
    async load() {
      const value = await adapter.get(SNAPSHOT_KEY);
      return isDashboardSnapshot(value) ? value : null;
    },
    async save(snapshot) {
      await adapter.set(SNAPSHOT_KEY, snapshot);
    },
    async clear() {
      await adapter.del(SNAPSHOT_KEY);
    },
  };
}

const indexedDbAdapter: KeyValueAdapter = { get, set, del };

export const snapshotRepository = createSnapshotRepository(indexedDbAdapter);
