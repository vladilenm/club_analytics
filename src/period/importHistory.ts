import { readCsvFile, resolveExportDate } from '../import/importCsvFile';
import { createRules, type HistoryRules } from './model';
import { parseTransactionsCsv } from './parseTransactionsCsv';
import type { HistoryRepository, HistorySnapshot } from './repository';

export async function importHistory(
  file: File, repository: HistoryRepository, previousRules?: HistoryRules,
  now: () => Date = () => new Date(),
): Promise<HistorySnapshot> {
  const transactions = parseTransactionsCsv(await readCsvFile(file));
  const importedAt = now();
  const exportDate = resolveExportDate(file.name, importedAt);
  if (transactions.some((t) => t.paidAt.slice(0, 10) > exportDate)) {
    throw new Error('В истории есть операции позже даты выгрузки. Проверьте дату в имени файла.');
  }
  const snapshot: HistorySnapshot = {
    schemaVersion: 1, transactions, rules: createRules(transactions, previousRules),
    metadata: { fileName: file.name, exportDate, importedAt: importedAt.toISOString() },
  };
  await repository.save(snapshot);
  return snapshot;
}
