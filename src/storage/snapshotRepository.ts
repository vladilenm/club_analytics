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

function isNormalizedIsoTimestamp(value: unknown, timestamp?: number): value is string {
  if (typeof value !== 'string') return false;
  const parsedTimestamp = Date.parse(value);

  return Number.isFinite(parsedTimestamp)
    && (timestamp === undefined || parsedTimestamp === timestamp)
    && new Date(parsedTimestamp).toISOString() === value;
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isImportMetadata(value: unknown): value is ImportMetadata {
  return isRecord(value)
    && typeof value.fileName === 'string'
    && value.fileName.trim() !== ''
    && /\.csv$/i.test(value.fileName)
    && isCalendarDate(value.exportDate)
    && isNormalizedIsoTimestamp(value.importedAt);
}

function isMemberRecord(value: unknown): value is MemberRecord {
  if (!isRecord(value)) return false;

  const {
    startedAt,
    endsAt,
    startedAtMs,
    endsAtMs,
    lifetimeDays,
    paymentCount,
  } = value;

  return typeof value.id === 'string'
    && value.id.trim() !== ''
    && value.id === value.id.trim()
    && typeof value.name === 'string'
    && typeof value.telegram === 'string'
    && typeof value.phone === 'string'
    && typeof value.plan === 'string'
    && (value.status === 'active' || value.status === 'churned')
    && typeof value.recurrent === 'boolean'
    && typeof startedAtMs === 'number'
    && Number.isFinite(startedAtMs)
    && typeof endsAtMs === 'number'
    && Number.isFinite(endsAtMs)
    && endsAtMs >= startedAtMs
    && isNormalizedIsoTimestamp(startedAt, startedAtMs)
    && isNormalizedIsoTimestamp(endsAt, endsAtMs)
    && typeof paymentCount === 'number'
    && Number.isSafeInteger(paymentCount)
    && paymentCount > 0
    && typeof lifetimeDays === 'number'
    && Number.isSafeInteger(lifetimeDays)
    && lifetimeDays >= 0
    && lifetimeDays === Math.floor((endsAtMs - startedAtMs) / 86_400_000);
}

function hasValidMembers(value: unknown): value is MemberRecord[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  const memberIds = new Set<string>();
  for (const member of value) {
    if (!isMemberRecord(member) || memberIds.has(member.id)) return false;
    memberIds.add(member.id);
  }

  return true;
}

function isDashboardSnapshot(value: unknown): value is DashboardSnapshot {
  return isRecord(value)
    && value.schemaVersion === 1
    && hasValidMembers(value.members)
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
