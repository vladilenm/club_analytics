import { describe, expect, it, vi } from 'vitest';
import { createRules } from './model';
import { createHistoryRepository, type HistorySnapshot } from './repository';
import { importHistory } from './importHistory';
import type { KeyValueAdapter } from '../storage/snapshotRepository';

const transaction = { userId: 'synthetic', paidAt: '2026-09-01T00:00:00.000Z', plan: 'Старт' };
export const history: HistorySnapshot = {
  schemaVersion: 1,
  transactions: [transaction],
  rules: createRules([transaction]),
  metadata: { fileName: 'history-2026-09-30.csv', exportDate: '2026-09-30', importedAt: '2026-09-30T12:00:00.000Z' },
};
const source = 'USER_ID,date,merchant,merchant_info,sum,plan,reflink,promo,comment\nsynthetic,2026-09-01 00:00:00,PRODAMUS,test,100.00,Старт,,,auto END';
const clock = () => new Date('2026-09-30T12:00:00.000Z');

function adapter(initial?: unknown): KeyValueAdapter {
  let value = initial;
  return { get: async () => value, set: async (_key, next) => { value = next; }, del: async () => { value = undefined; } };
}

describe('history persistence', () => {
  it('round trips data and assumptions independently of the member snapshot', async () => {
    const memory = adapter();
    const set = vi.spyOn(memory, 'set');
    const repository = createHistoryRepository(memory);
    await repository.save(history);
    expect(set).toHaveBeenCalledWith('analytics-club/transaction-history', history);
    expect(await repository.load()).toEqual(history);
  });
  it.each([
    { ...history, schemaVersion: 2 },
    { ...history, transactions: [] },
    { ...history, transactions: [transaction, transaction] },
    { ...history, transactions: [{ ...transaction, paidAt: '2026-02-30T00:00:00.000Z' }] },
    { ...history, rules: { ...history.rules, gapHours: -1 } },
    { ...history, metadata: { ...history.metadata, exportDate: '2026-08-01' } },
  ])('rejects invalid saved data', async (value) => {
    expect(await createHistoryRepository(adapter(value)).load()).toBeNull();
  });
  it('imports a full replacement while preserving the chosen renewal mode', async () => {
    const repository = createHistoryRepository(adapter(history));
    const rules = { ...history.rules, renewal: 'remaining' as const };
    const next = await importHistory(new File([source], 'transactions-2026-09-30.csv'), repository, rules, clock);
    expect(next.rules.renewal).toBe('remaining');
    expect(next.transactions).toEqual([transaction]);
    expect(await repository.load()).toEqual(next);
  });
  it.each([
    new File(['broken'], 'broken.csv'),
    new File([source], 'history-2026-08-01.csv'),
    new File([new Uint8Array([0xff])], 'history.csv'),
    new File([source], 'history.txt'),
  ])('leaves the last good history intact on invalid input', async (file) => {
    const repository = createHistoryRepository(adapter(history));
    await expect(importHistory(file, repository, undefined, clock)).rejects.toThrow();
    expect(await repository.load()).toEqual(history);
  });
  it('does not return a successful import when saving fails', async () => {
    const repository = { load: async () => history, save: vi.fn().mockRejectedValue(new Error('disk full')) };
    await expect(importHistory(new File([source], 'history.csv'), repository, undefined, clock)).rejects.toThrow('disk full');
  });
});
