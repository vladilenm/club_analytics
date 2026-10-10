import Papa from 'papaparse';
import type { MemberRecord, MemberStatus } from '../domain/member';
import type { PeriodEventKey, PeriodParticipant } from './analytics';

export interface ParticipantRow extends PeriodParticipant {
  name: string;
  telegram: string;
  phone: string;
  snapshotStatus: MemberStatus | null;
}

export interface PeriodExportContext {
  event: PeriodEventKey;
  from: string;
  to: string;
  historyExportDate: string;
  memberExportDate?: string;
}

export const periodEventLabels: Record<PeriodEventKey, string> = {
  joined: 'Новые', left: 'Ушедшие', returned: 'Вернувшиеся',
};

export function snapshotStatusLabel(status: MemberStatus | null): string {
  return status === null ? 'Нет в CSV' : status === 'active' ? 'Активен' : 'Отменил';
}

export function buildParticipantRows(
  participants: readonly PeriodParticipant[], members: readonly MemberRecord[],
): ParticipantRow[] {
  const contacts = new Map(members.map((member) => [member.id, member]));
  return participants.map((person): ParticipantRow => {
    const contact = contacts.get(person.userId);
    return {
      ...person, name: contact?.name ?? '', telegram: contact?.telegram ?? '',
      phone: contact?.phone ?? '', snapshotStatus: contact?.status ?? null,
    };
  }).sort((a, b) => b.dates[b.dates.length - 1] - a.dates[a.dates.length - 1]
    || a.userId.localeCompare(b.userId, 'ru'));
}

export function serializeParticipantsCsv(rows: readonly ParticipantRow[], context: PeriodExportContext): string {
  const fields = [
    'USER_ID', 'Имя', 'Telegram', 'Телефон', 'Событие', 'Даты событий (UTC)',
    'Доступ на конец периода', 'Статус в CSV участников', 'Начало периода', 'Конец периода',
    'Выгрузка транзакций', 'Выгрузка участников',
  ];
  const data = rows.map((row) => [
    row.userId, row.name, row.telegram, row.phone, periodEventLabels[context.event],
    row.dates.map((date) => new Date(date).toISOString()).join('; '),
    row.activeAtEnd ? 'Есть доступ' : 'Нет доступа', snapshotStatusLabel(row.snapshotStatus),
    context.from, context.to, context.historyExportDate, context.memberExportDate ?? '',
  ]);
  return Papa.unparse({ fields, data }, { delimiter: ';', escapeFormulae: true });
}
