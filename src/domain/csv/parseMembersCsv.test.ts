import { describe, expect, it } from 'vitest';
import { makeCsv, makeRawMember } from '../../test/csvFixture';
import { ImportError } from '../importError';
import { parseMembersCsv } from './parseMembersCsv';

describe('parseMembersCsv', () => {
  function expectImportCode(run: () => unknown, code: ImportError['code']) {
    try {
      run();
      expect.fail('Expected import validation to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ImportError);
      expect((error as ImportError).code).toBe(code);
    }
  }

  it('normalizes quoted Unicode paid-member data and ignores trial-only rows', () => {
    const csv = makeCsv([
      makeRawMember({ USER_ID: 'i1', name: 'Иван, 🚀', phone: '+79000000001' }),
      makeRawMember({ USER_ID: 'i2', use_trial: '+', active: '', plan: '', pay_count: '', pay_1st: '', end_date: '' }),
    ]);

    expect(parseMembersCsv(csv)).toEqual([
      expect.objectContaining({
        id: 'i1', name: 'Иван, 🚀', phone: '+79000000001',
        telegram: '@synthetic_user', status: 'active', paymentCount: 1,
        lifetimeDays: 30, recurrent: true,
      }),
    ]);
  });

  it('accepts a UTF-8 BOM before the required headers', () => {
    const csv = `\uFEFF${makeCsv([makeRawMember({ USER_ID: 'bom-member' })])}`;

    expect(parseMembersCsv(csv)).toEqual([
      expect.objectContaining({ id: 'bom-member' }),
    ]);
  });

  it('ignores additional columns from a compatible export', () => {
    const [headers, row] = makeCsv([makeRawMember({ USER_ID: 'extra-member' })]).split('\r\n');
    const csv = `${headers},future_field\r\n${row},future value`;

    expect(parseMembersCsv(csv)).toEqual([
      expect.objectContaining({ id: 'extra-member' }),
    ]);
  });

  it('parses multiline quoted cells without changing member text', () => {
    const name = 'Synthetic, member\nsecond line';

    expect(parseMembersCsv(makeCsv([makeRawMember({ USER_ID: 'multiline', name })]))).toEqual([
      expect.objectContaining({ id: 'multiline', name }),
    ]);
  });

  it('normalizes timezone offsets before calculating lifetime', () => {
    const csv = makeCsv([makeRawMember({
      USER_ID: 'offset-member',
      pay_1st: '2026-01-01T03:00:00+03:00',
      end_date: '2026-01-02T05:30:00+03:00',
    })]);

    expect(parseMembersCsv(csv)).toEqual([
      expect.objectContaining({
        id: 'offset-member',
        startedAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-01-02T02:30:00.000Z',
        lifetimeDays: 1,
      }),
    ]);
  });

  it('preserves supported fractional seconds in normalized timestamps', () => {
    const csv = makeCsv([makeRawMember({
      USER_ID: 'fraction-member',
      pay_1st: '2026-01-01T00:00:00.250Z',
      end_date: '2026-01-02T00:00:00.500Z',
    })]);

    expect(parseMembersCsv(csv)).toEqual([
      expect.objectContaining({
        id: 'fraction-member',
        startedAt: '2026-01-01T00:00:00.250Z',
        endsAt: '2026-01-02T00:00:00.500Z',
        lifetimeDays: 1,
      }),
    ]);
  });

  it('ignores truncated unpaid rows whose payment fields are all empty', () => {
    const csv = `${makeCsv([makeRawMember({ USER_ID: 'paid' })])}\r\nunpaid,,,,,,,,`;

    expect(parseMembersCsv(csv)).toEqual([
      expect.objectContaining({ id: 'paid', paymentCount: 1 }),
    ]);
  });

  it('rejects a truncated row when any payment field is populated', () => {
    const csv = `${makeCsv([makeRawMember({ USER_ID: 'paid' })])}\r\nincomplete,,,,,,,,,,,,,,1`;

    expectImportCode(() => parseMembersCsv(csv), 'CSV_PARSE_ERROR');
  });

  it.each([
    ['INVALID_STATUS', { active: 'yes' }],
    ['INVALID_PAYMENT_COUNT', { pay_count: 'x' }],
    ['INVALID_DATE', { end_date: 'not-a-date' }],
  ] as const)('throws %s for invalid paid data', (code, override) => {
    expectImportCode(() => parseMembersCsv(makeCsv([makeRawMember(override)])), code);
  });

  it('rejects duplicate paid USER_ID values', () => {
    const row = makeRawMember({ USER_ID: 'duplicate' });
    expectImportCode(
      () => parseMembersCsv(makeCsv([row, row])),
      'DUPLICATE_USER_ID',
    );
  });

  it('rejects a file with missing required columns', () => {
    expectImportCode(() => parseMembersCsv('USER_ID,name\ni1,Test'), 'MISSING_COLUMNS');
  });

  it('rejects partially populated payment data', () => {
    const partial = makeRawMember({ pay_count: '1', pay_1st: '', end_date: '' });
    expectImportCode(
      () => parseMembersCsv(makeCsv([partial])),
      'INCOMPLETE_PAYMENT_DATA',
    );
  });

  it('requires USER_ID for a paid member', () => {
    expectImportCode(
      () => parseMembersCsv(makeCsv([makeRawMember({ USER_ID: '' })])),
      'MISSING_USER_ID',
    );
  });

  it('rejects a file with no paid members', () => {
    const trial = makeRawMember({ active: '', plan: '', pay_count: '', pay_1st: '', end_date: '' });
    expectImportCode(
      () => parseMembersCsv(makeCsv([trial])),
      'NO_PAID_MEMBERS',
    );
  });
});
