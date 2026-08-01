import { ImportError } from '../domain/importError';
import { parseMembersCsv } from '../domain/csv/parseMembersCsv';
import type { DashboardSnapshot, SnapshotRepository } from '../storage/snapshotRepository';

const csvSuffix = /\.csv$/i;
const dateToken = /20\d{2}-\d{2}-\d{2}/g;

function isCalendarDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function resolveExportDate(fileName: string, fallbackDate: Date): string {
  for (const match of fileName.matchAll(dateToken)) {
    if (isCalendarDate(match[0])) {
      return match[0];
    }
  }

  return formatLocalDate(fallbackDate);
}

export async function importCsvFile(
  file: File,
  repository: SnapshotRepository,
  now: () => Date = () => new Date(),
): Promise<DashboardSnapshot> {
  if (!csvSuffix.test(file.name)) {
    throw new ImportError('NOT_CSV');
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new ImportError('UNREADABLE_FILE');
  }

  let csvText: string;
  try {
    csvText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ImportError('INVALID_ENCODING');
  }

  const importedAt = now();
  const snapshot: DashboardSnapshot = {
    schemaVersion: 1,
    members: parseMembersCsv(csvText),
    metadata: {
      fileName: file.name,
      exportDate: resolveExportDate(file.name, importedAt),
      importedAt: importedAt.toISOString(),
    },
  };

  await repository.save(snapshot);
  return snapshot;
}
