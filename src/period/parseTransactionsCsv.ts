import Papa from 'papaparse';
import { parseDate } from '../domain/csv/parseDate';
import { ImportError } from '../domain/importError';
import type { Transaction } from './model';

const requiredHeaders = ['USER_ID', 'date', 'merchant', 'merchant_info', 'sum', 'plan', 'reflink', 'promo', 'comment'];

export function parseTransactionsCsv(csv: string): Transaction[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true, skipEmptyLines: 'greedy', transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length || Object.keys(parsed.meta.renamedHeaders ?? {}).length > 0) {
    throw new ImportError('CSV_PARSE_ERROR');
  }
  const missing = requiredHeaders.filter((header) => !parsed.meta.fields?.includes(header));
  if (missing.length) throw new ImportError('MISSING_COLUMNS', missing);
  const seen = new Set<string>();
  const transactions = parsed.data.map((row): Transaction => {
    const userId = row.USER_ID.trim();
    const plan = row.plan.trim();
    if (!userId || !plan) throw new Error('У каждой транзакции должны быть USER_ID и тариф.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(row.sum.trim()) || !Number.isFinite(Number(row.sum))) {
      throw new Error('Сумма транзакции должна быть неотрицательной. Возвраты денег не поддерживаются.');
    }
    const paidAt = parseDate(row.date.trim()).iso;
    const key = JSON.stringify([userId, paidAt]);
    if (seen.has(key)) throw new Error('Найдены несколько операций участника в один момент. Проверьте дубли в выгрузке.');
    seen.add(key);
    return { userId, paidAt, plan };
  });
  if (!transactions.length) throw new Error('В файле нет транзакций.');
  return transactions;
}
