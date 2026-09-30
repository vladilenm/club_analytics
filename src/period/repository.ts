import { get, set } from 'idb-keyval';
import { parseDate } from '../domain/csv/parseDate';
import { isImportMetadata, type ImportMetadata, type KeyValueAdapter } from '../storage/snapshotRepository';
import { isHistoryRules, type HistoryRules, type Transaction } from './model';

const key = 'analytics-club/transaction-history';

export interface HistorySnapshot {
  schemaVersion: 1;
  transactions: Transaction[];
  metadata: ImportMetadata;
  rules: HistoryRules;
}

export interface HistoryRepository {
  load(): Promise<HistorySnapshot | null>;
  save(snapshot: HistorySnapshot): Promise<void>;
}

function isHistorySnapshot(value: unknown): value is HistorySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as HistorySnapshot;
  if (snapshot.schemaVersion !== 1 || !isImportMetadata(snapshot.metadata)
    || !isHistoryRules(snapshot.rules) || !Array.isArray(snapshot.transactions)
    || snapshot.transactions.length === 0) return false;
  const seen = new Set<string>();
  try {
    for (const transaction of snapshot.transactions) {
      if (!transaction || typeof transaction.userId !== 'string' || !transaction.userId.trim()
        || transaction.userId !== transaction.userId.trim()
        || typeof transaction.plan !== 'string' || !transaction.plan.trim()
        || transaction.plan !== transaction.plan.trim() || typeof transaction.paidAt !== 'string'
        || parseDate(transaction.paidAt).iso !== transaction.paidAt
        || transaction.paidAt.slice(0, 10) > snapshot.metadata.exportDate) return false;
      const identity = JSON.stringify([transaction.userId, transaction.paidAt]);
      if (seen.has(identity)) return false;
      seen.add(identity);
    }
  } catch {
    return false;
  }
  return true;
}

export function createHistoryRepository(adapter: Pick<KeyValueAdapter, 'get' | 'set'>): HistoryRepository {
  return {
    async load() {
      const value = await adapter.get(key);
      return isHistorySnapshot(value) ? value : null;
    },
    async save(snapshot) {
      if (!isHistorySnapshot(snapshot)) throw new Error('Проверьте данные и правила расчёта.');
      await adapter.set(key, snapshot);
    },
  };
}

export const historyRepository = createHistoryRepository({ get, set });
