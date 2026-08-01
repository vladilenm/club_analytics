import Papa from 'papaparse';
import { ImportError } from '../importError';
import type { MemberRecord, MemberStatus } from '../member';

const requiredHeaders = [
  'USER_ID',
  'registration',
  'username',
  'name',
  'ref_link',
  'phone',
  'email',
  'comment',
  'active',
  'plan',
  'end_date',
  'use_trial',
  'recurrent',
  'tags',
  'pay_count',
  'pay_last',
  'pay_1st',
] as const;

const utcDatePattern = /^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/;

function read(row: Record<string, string>, header: string): string {
  return (row[header] ?? '').trim();
}

function parseDate(value: string): { milliseconds: number; iso: string } {
  const match = utcDatePattern.exec(value);
  if (!match) {
    throw new ImportError('INVALID_DATE');
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', fractionText = '', offset = ''] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fractionText.padEnd(3, '0'));
  const wallClockMilliseconds = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const wallClock = new Date(wallClockMilliseconds);

  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day ||
    wallClock.getUTCHours() !== hour ||
    wallClock.getUTCMinutes() !== minute ||
    wallClock.getUTCSeconds() !== second
  ) {
    throw new ImportError('INVALID_DATE');
  }

  const milliseconds = offset ? Date.parse(value.replace(' ', 'T')) : wallClockMilliseconds;
  if (!Number.isFinite(milliseconds)) {
    throw new ImportError('INVALID_DATE');
  }

  return { milliseconds, iso: new Date(milliseconds).toISOString() };
}

function normalizeTelegram(username: string): string {
  if (!username || username.startsWith('@')) {
    return username;
  }

  return `@${username}`;
}

export function parseMembersCsv(csvText: string): MemberRecord[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (value) => value.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new ImportError('CSV_PARSE_ERROR');
  }

  const fieldSet = new Set(parsed.meta.fields ?? []);
  const missingColumns = requiredHeaders.filter((header) => !fieldSet.has(header));
  if (missingColumns.length > 0) {
    throw new ImportError('MISSING_COLUMNS', missingColumns);
  }

  const memberIds = new Set<string>();
  const members: MemberRecord[] = [];

  for (const row of parsed.data) {
    const paymentCount = read(row, 'pay_count');
    const startedAt = read(row, 'pay_1st');
    const endsAt = read(row, 'end_date');
    const paymentFields = [paymentCount, startedAt, endsAt];

    if (paymentFields.every((value) => value === '')) {
      continue;
    }
    if (paymentFields.some((value) => value === '')) {
      throw new ImportError('INCOMPLETE_PAYMENT_DATA');
    }

    const id = read(row, 'USER_ID');
    if (!id) {
      throw new ImportError('MISSING_USER_ID');
    }
    if (memberIds.has(id)) {
      throw new ImportError('DUPLICATE_USER_ID');
    }

    const active = read(row, 'active');
    if (active !== '0' && active !== '1') {
      throw new ImportError('INVALID_STATUS');
    }

    if (!/^\d+$/.test(paymentCount) || Number(paymentCount) <= 0 || !Number.isSafeInteger(Number(paymentCount))) {
      throw new ImportError('INVALID_PAYMENT_COUNT');
    }

    const parsedStartedAt = parseDate(startedAt);
    const parsedEndsAt = parseDate(endsAt);
    const lifetimeDays = Math.floor((parsedEndsAt.milliseconds - parsedStartedAt.milliseconds) / 86_400_000);
    if (lifetimeDays < 0) {
      throw new ImportError('INVALID_DATE');
    }

    memberIds.add(id);
    members.push({
      id,
      name: read(row, 'name'),
      telegram: normalizeTelegram(read(row, 'username')),
      phone: read(row, 'phone'),
      startedAt: parsedStartedAt.iso,
      endsAt: parsedEndsAt.iso,
      startedAtMs: parsedStartedAt.milliseconds,
      endsAtMs: parsedEndsAt.milliseconds,
      status: (active === '1' ? 'active' : 'churned') satisfies MemberStatus,
      plan: read(row, 'plan'),
      paymentCount: Number(paymentCount),
      lifetimeDays,
      recurrent: read(row, 'recurrent') === '+',
    });
  }

  if (members.length === 0) {
    throw new ImportError('NO_PAID_MEMBERS');
  }

  return members;
}
