import Papa from 'papaparse';

export const requiredCsvHeaders = [
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

export type RawMember = Record<(typeof requiredCsvHeaders)[number], string>;

export function makeRawMember(overrides: Partial<RawMember> = {}): RawMember {
  return {
    USER_ID: 'synthetic-1',
    registration: '2024-01-01 00:00:00',
    username: 'synthetic_user',
    name: 'Synthetic Member',
    ref_link: '',
    phone: '+79000000000',
    email: 'synthetic@example.test',
    comment: '',
    active: '1',
    plan: 'monthly',
    end_date: '2024-01-31 00:00:00',
    use_trial: '',
    recurrent: '+',
    tags: '',
    pay_count: '1',
    pay_last: '2024-01-01 00:00:00',
    pay_1st: '2024-01-01 00:00:00',
    ...overrides,
  };
}

export function makeCsv(rows: RawMember[]): string {
  return Papa.unparse(rows, { columns: [...requiredCsvHeaders] });
}
