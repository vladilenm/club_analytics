import { ImportError } from "../importError";

const utcDatePattern = /^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/;

export function parseDate(value: string): { milliseconds: number; iso: string } {
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
