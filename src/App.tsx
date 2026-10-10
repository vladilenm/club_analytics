import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ImportControl } from './components/ImportControl';
import { Dashboard } from './components/Dashboard';
import { PeriodAnalytics } from './period/PeriodAnalytics';
import { buildDashboardModel } from './domain/analytics';
import { ImportError } from './domain/importError';
import { importCsvFile } from './import/importCsvFile';
import {
  snapshotRepository,
  type DashboardSnapshot,
  type SnapshotRepository,
} from './storage/snapshotRepository';

export interface AppProps {
  repository?: SnapshotRepository;
}

export type AppPhase = 'loading' | 'ready-empty' | 'ready-data' | 'importing';

interface AppState {
  repository: SnapshotRepository;
  phase: AppPhase;
  snapshot: DashboardSnapshot | null;
  error: string | null;
}

const loadErrorMessage = 'Не удалось загрузить локальные данные. Загрузите CSV заново.';
const importErrorMessage = 'Не удалось обработать CSV. Попробуйте снова.';

function getImportErrorMessage(error: unknown): string {
  return error instanceof ImportError ? error.message : importErrorMessage;
}

export function App({ repository: repositoryProp }: AppProps) {
  const repository = repositoryProp ?? snapshotRepository;
  const [state, setState] = useState<AppState>(() => ({
    repository,
    phase: 'loading',
    snapshot: null,
    error: null,
  }));
  const loadRequestsRef = useRef(new WeakMap<SnapshotRepository, Promise<DashboardSnapshot | null>>());
  const mountedRef = useRef(false);
  const currentRepositoryRef = useRef(repository);
  const operationGenerationRef = useRef(0);
  const isCurrentRepository = state.repository === repository;
  const phase = isCurrentRepository ? state.phase : 'loading';
  const snapshot = isCurrentRepository ? state.snapshot : null;
  const error = isCurrentRepository ? state.error : null;
  const dashboard = useMemo(
    () => snapshot ? buildDashboardModel(snapshot.members) : null,
    [snapshot],
  );

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationGenerationRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    currentRepositoryRef.current = repository;
    operationGenerationRef.current += 1;
  }, [repository]);

  useEffect(() => {
    let request = loadRequestsRef.current.get(repository);
    if (!request) {
      request = repository.load();
      loadRequestsRef.current.set(repository, request);
    }

    let active = true;

    void request.then(
      (loadedSnapshot) => {
        if (!active) return;
        setState({
          repository,
          phase: loadedSnapshot ? 'ready-data' : 'ready-empty',
          snapshot: loadedSnapshot,
          error: null,
        });
      },
      () => {
        if (!active) return;
        setState({
          repository,
          phase: 'ready-empty',
          snapshot: null,
          error: loadErrorMessage,
        });
      },
    );

    return () => {
      active = false;
    };
  }, [repository]);

  const handleFile = useCallback(async (file: File): Promise<void> => {
    const operationGeneration = operationGenerationRef.current + 1;
    operationGenerationRef.current = operationGeneration;
    setState((current) => current.repository === repository
      ? { ...current, phase: 'importing', error: null }
      : current);

    try {
      const importedSnapshot = await importCsvFile(file, repository);
      if (
        !mountedRef.current
        || currentRepositoryRef.current !== repository
        || operationGenerationRef.current !== operationGeneration
      ) return;

      loadRequestsRef.current.set(repository, Promise.resolve(importedSnapshot));
      setState({
        repository,
        phase: 'ready-data',
        snapshot: importedSnapshot,
        error: null,
      });
    } catch (importError) {
      if (
        !mountedRef.current
        || currentRepositoryRef.current !== repository
        || operationGenerationRef.current !== operationGeneration
      ) return;

      setState((current) => current.repository === repository
        ? {
            ...current,
            phase: current.snapshot ? 'ready-data' : 'ready-empty',
            error: getImportErrorMessage(importError),
          }
        : current);
    }
  }, [repository]);

  return (
    <main className="wrap">
      <header className="app-header">
        <h1>
          <svg className="club-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path d="M16 2.75 19.2 12.8 29.25 16l-10.05 3.2L16 29.25l-3.2-10.05L2.75 16l10.05-3.2L16 2.75Z" />
            <circle cx="16" cy="16" r="3.25" />
          </svg>
          <span>Клуб Незаменимых</span>
        </h1>
        {phase === 'loading' ? null : (
          <ImportControl
            metadata={snapshot?.metadata ?? null}
            importing={phase === 'importing'}
            error={error}
            onFile={handleFile}
          />
        )}
      </header>

      {phase === 'loading' ? <p className="loading-state" role="status">Загрузка локальных данных…</p> : null}
      {phase !== 'loading' ? <PeriodAnalytics memberSnapshot={snapshot} /> : null}
      {phase === 'ready-empty' ? (
        <section className="empty-state">
          <div>
            <h2>Загрузите CSV</h2>
            <p>Выберите экспорт участников, чтобы открыть дашборд.</p>
          </div>
        </section>
      ) : null}
      {dashboard ? (
        <Dashboard members={snapshot?.members ?? []} model={dashboard} />
      ) : null}
    </main>
  );
}
