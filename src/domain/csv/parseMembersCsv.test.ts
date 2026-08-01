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
