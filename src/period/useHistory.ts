import { useEffect, useRef, useState } from 'react';
import { importHistory } from './importHistory';
import type { HistoryRules } from './model';
import type { HistoryRepository, HistorySnapshot } from './repository';

export function useHistory(repository: HistoryRepository) {
  const [snapshot, setSnapshot] = useState<HistorySnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const pending = useRef(true);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void repository.load().then((value) => {
      if (active) { setSnapshot(value); setBusy(false); pending.current = false; }
    }).catch(() => {
      if (active) {
        setError('Не удалось прочитать историю. Загрузите транзакции заново.');
        setBusy(false);
        pending.current = false;
      }
    });
    return () => { active = false; mounted.current = false; };
  }, [repository]);

  async function run(operation: () => Promise<HistorySnapshot>, fallback: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await operation();
      if (mounted.current) setSnapshot(next);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : fallback);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function upload(file: File) {
    return run(async () => {
      // Report storage failures without exposing browser internals or row data.
      const safeRepository: HistoryRepository = {
        load: () => repository.load(),
        save: async (next) => {
          try { await repository.save(next); }
          catch { throw new Error('Не удалось сохранить историю. Предыдущие данные сохранены.'); }
        },
      };
      return importHistory(file, safeRepository, snapshot?.rules);
    }, 'Не удалось загрузить транзакции.');
  }

  function saveRules(rules: HistoryRules) {
    if (!snapshot) return Promise.resolve();
    return run(async () => {
      const next = { ...snapshot, rules };
      try { await repository.save(next); }
      catch { throw new Error('Не удалось сохранить правила. Действуют предыдущие настройки.'); }
      return next;
    }, 'Не удалось сохранить правила.');
  }

  return { snapshot, busy, error, upload, saveRules };
}
