import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { parseMembersCsv } from '../domain/csv/parseMembersCsv';
import { makeCsv, makeRawMember } from '../test/csvFixture';
import { buildParticipantRows, serializeParticipantsCsv } from './participants';

const members = parseMembersCsv(makeCsv([
  makeRawMember({ USER_ID: 'returned', name: 'Вернулся', username: 'test_returned' }),
  makeRawMember({ USER_ID: 'cancelled', active: '0', name: '=1+1', username: 'test_cancelled' }),
]));
const participants = [
  { userId: 'returned', dates: [Date.parse('2026-10-02')], activeAtEnd: true },
  { userId: 'missing', dates: [Date.parse('2026-10-01'), Date.parse('2026-10-06')], activeAtEnd: false },
  { userId: 'cancelled', dates: [Date.parse('2026-10-03')], activeAtEnd: false },
];

describe('period participant contacts and export', () => {
  it('preserves missing contacts and current active members while joining contacts by ID', () => {
    const rows = buildParticipantRows(participants, members);
    expect(rows.map((row) => row.userId)).toEqual(['missing', 'cancelled', 'returned']);
    expect(rows[0]).toMatchObject({ name: '', telegram: '', phone: '', snapshotStatus: null });
    expect(rows[2]).toMatchObject({ name: 'Вернулся', telegram: '@test_returned', snapshotStatus: 'active' });
    expect(participants[0].userId).toBe('returned');
  });

  it('exports the exact cohort including all event dates and safely escaped contact values', () => {
    const rows = buildParticipantRows(participants, members);
    const source = serializeParticipantsCsv(rows, {
      event: 'left', from: '2026-10-01', to: '2026-10-07',
      historyExportDate: '2026-10-10', memberExportDate: '2026-10-09',
    });
    const parsed = Papa.parse<Record<string, string>>(source, { header: true });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toHaveLength(3);
    expect(parsed.data.map((row) => row.USER_ID)).toEqual(['missing', 'cancelled', 'returned']);
    expect(parsed.data[0]['Даты событий (UTC)']).toBe('2026-10-01T00:00:00.000Z; 2026-10-06T00:00:00.000Z');
    expect(parsed.data[0]['Статус в CSV участников']).toBe('Нет в CSV');
    expect(parsed.data[1]['Имя']).toBe("'=1+1");
    expect(parsed.data[2]['Доступ на конец периода']).toBe('Есть доступ');
    expect(parsed.data[2]['Статус в CSV участников']).toBe('Активен');
    expect(parsed.data[2]['Выгрузка участников']).toBe('2026-10-09');
    expect(parsed.data[2]['Телефон']).toBe("'+79000000000");
  });
});
