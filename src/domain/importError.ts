export type ImportErrorCode =
  | 'NOT_CSV'
  | 'UNREADABLE_FILE'
  | 'INVALID_ENCODING'
  | 'CSV_PARSE_ERROR'
  | 'MISSING_COLUMNS'
  | 'INCOMPLETE_PAYMENT_DATA'
  | 'MISSING_USER_ID'
  | 'DUPLICATE_USER_ID'
  | 'INVALID_STATUS'
  | 'INVALID_PAYMENT_COUNT'
  | 'INVALID_DATE'
  | 'NO_PAID_MEMBERS';

const messages: Record<ImportErrorCode, string> = {
  NOT_CSV: 'Выберите файл в формате CSV.',
  UNREADABLE_FILE: 'Не удалось прочитать файл. Экспортируйте его заново.',
  INVALID_ENCODING: 'Файл должен быть в кодировке UTF-8.',
  CSV_PARSE_ERROR: 'Не удалось разобрать CSV. Экспортируйте файл заново.',
  MISSING_COLUMNS: 'В CSV отсутствуют обязательные столбцы.',
  INCOMPLETE_PAYMENT_DATA: 'В строке участника заполнены не все данные об оплате.',
  MISSING_USER_ID: 'У платного участника отсутствует USER_ID.',
  DUPLICATE_USER_ID: 'USER_ID платного участника должен быть уникальным.',
  INVALID_STATUS: 'Статус платного участника должен быть 0 или 1.',
  INVALID_PAYMENT_COUNT: 'Количество оплат должно быть положительным целым числом.',
  INVALID_DATE: 'Дата оплаты или окончания участия некорректна.',
  NO_PAID_MEMBERS: 'В файле не найдено платных участников.',
};

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  readonly missingColumns?: readonly string[];

  constructor(code: ImportErrorCode, missingColumns?: readonly string[]) {
    super(
      code === 'MISSING_COLUMNS' && missingColumns?.length
        ? `${messages[code]} Проверьте: ${missingColumns.join(', ')}.`
        : messages[code],
    );
    this.name = 'ImportError';
    this.code = code;
    this.missingColumns = missingColumns;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
