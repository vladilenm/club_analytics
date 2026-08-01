import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberRecord } from './domain/member';
import type { DashboardSnapshot, SnapshotRepository } from './storage/snapshotRepository';
import { makeCsv, makeRawMember } from './test/csvFixture';
import { App } from './App';

afterEach(cleanup);

const cachedSnapshot: DashboardSnapshot = {
  schemaVersion: 1,
  members: [{
    id: 'cached',
    name: 'Кэшированный участник',
    telegram: '@cached',
    phone: '+79000000000',
    startedAt: '2026-07-01T00:00:00.000Z',
    endsAt: '2026-08-01T00:00:00.000Z',
    startedAtMs: Date.parse('2026-07-01T00:00:00.000Z'),
    endsAtMs: Date.parse('2026-08-01T00:00:00.000Z'),
    status: 'active',
    plan: '1 месяц',
    paymentCount: 1,
    lifetimeDays: 31,
    recurrent: true,
  } satisfies MemberRecord],
  metadata: {
    fileName: 'cached-2026-08-01.csv',
    exportDate: '2026-08-01',
    importedAt: '2026-08-01T12:00:00.000Z',
  },
};

function createRepository(loadResult: DashboardSnapshot | null | Promise<DashboardSnapshot | null>): SnapshotRepository {
  return {
    load: vi.fn(async () => Promise.resolve(loadResult)),
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
}

describe('App', () => {
  it('shows a loading status while the local snapshot is pending', () => {
    const pending = new Promise<DashboardSnapshot | null>(() => undefined);

    render(<App repository={createRepository(pending)} />);

    expect(screen.getByRole('status')).toHaveTextContent('Загрузка локальных данных…');
  });

  it('loads each repository once even when mounted in StrictMode', async () => {
    const repository = createRepository(null);

    render(
      <StrictMode>
        <App repository={repository} />
      </StrictMode>,
    );

    expect(await screen.findByRole('heading', { name: 'Загрузите CSV' })).toBeInTheDocument();
    expect(repository.load).toHaveBeenCalledTimes(1);
  });

  it('shows the empty import state when no cached snapshot exists', async () => {
    render(<App repository={createRepository(null)} />);

    expect(await screen.findByRole('heading', { name: 'Загрузите CSV' })).toBeInTheDocument();
  });

  it('shows a stable Russian error when local loading fails', async () => {
    const repository = createRepository(Promise.reject(new Error('storage internals')));

    render(<App repository={repository} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить локальные данные. Загрузите CSV заново.',
    );
    expect(screen.getByRole('heading', { name: 'Загрузите CSV' })).toBeInTheDocument();
  });

  it('reuses a completed load when returning to a previous repository', async () => {
    const firstRepository = createRepository(null);
    const secondRepository = createRepository(cachedSnapshot);
    const { rerender } = render(<App repository={firstRepository} />);
    await screen.findByRole('heading', { name: 'Загрузите CSV' });

    rerender(<App repository={secondRepository} />);
    await screen.findByText('cached-2026-08-01.csv');
    rerender(<App repository={firstRepository} />);
    await screen.findByRole('heading', { name: 'Загрузите CSV' });

    expect(firstRepository.load).toHaveBeenCalledTimes(1);
    expect(secondRepository.load).toHaveBeenCalledTimes(1);
  });

  it('restores the cached filename and dashboard', async () => {
    render(<App repository={createRepository(cachedSnapshot)} />);

    expect(await screen.findByText('cached-2026-08-01.csv')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Дашборд участников' })).toBeInTheDocument();
  });

  it('replaces the current snapshot after a successful file selection', async () => {
    const user = userEvent.setup();
    const repository = createRepository(null);
    const file = new File(
      [makeCsv([makeRawMember({ USER_ID: 'fresh' })])],
      'fresh-2026-08-02.csv',
      { type: 'text/csv' },
    );
    render(<App repository={repository} />);

    await screen.findByRole('heading', { name: 'Загрузите CSV' });
    await user.upload(screen.getByLabelText('Загрузить CSV'), file);

    expect(await screen.findByText('fresh-2026-08-02.csv')).toBeInTheDocument();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the first dataset visible when a second import is invalid', async () => {
    const user = userEvent.setup();
    const repository = createRepository(null);
    const validFile = new File(
      [makeCsv([makeRawMember({ USER_ID: 'working' })])],
      'working-2026-08-02.csv',
      { type: 'text/csv' },
    );
    const invalidFile = new File(['USER_ID,name\ninvalid,Test'], 'broken.csv', { type: 'text/csv' });
    render(<App repository={repository} />);

    const input = await screen.findByLabelText('Загрузить CSV');
    await user.upload(input, validFile);
    await screen.findByText('working-2026-08-02.csv');
    await user.upload(input, invalidFile);

    expect(await screen.findByText('В CSV отсутствуют обязательные столбцы.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('working-2026-08-02.csv')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Дашборд участников' })).toBeInTheDocument();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
