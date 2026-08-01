import { useEffect, useRef, useState } from 'react';
import type { ImportMetadata } from '../storage/snapshotRepository';

export interface ImportControlProps {
  metadata: ImportMetadata | null;
  importing: boolean;
  error: string | null;
  onFile(file: File): void;
}

const exportDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatExportDate(exportDate: string): string {
  return exportDateFormatter.format(new Date(`${exportDate}T00:00:00Z`));
}

function containsFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function ImportControl({ metadata, importing, error, onFile }: ImportControlProps) {
  const dragDepthRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    function handleDragEnter(event: DragEvent): void {
      if (importing || !containsFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setDragActive(true);
    }

    function handleDragOver(event: DragEvent): void {
      if (importing || !containsFiles(event)) return;
      event.preventDefault();
    }

    function handleDragLeave(): void {
      if (dragDepthRef.current === 0) return;
      dragDepthRef.current -= 1;
      if (dragDepthRef.current === 0) setDragActive(false);
    }

    function handleDrop(event: DragEvent): void {
      const isFileDrag = containsFiles(event);
      dragDepthRef.current = 0;
      setDragActive(false);
      if (!isFileDrag) return;

      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (!importing && file) onFile(file);
    }

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [importing, onFile]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) onFile(file);
  }

  function handleLabelKeyDown(event: React.KeyboardEvent<HTMLLabelElement>): void {
    if (importing || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    inputRef.current?.click();
  }

  return (
    <section aria-label="Импорт CSV">
      <label
        htmlFor="csv-file"
        role="button"
        tabIndex={importing ? -1 : 0}
        aria-controls="csv-file"
        aria-disabled={importing ? 'true' : undefined}
        onKeyDown={handleLabelKeyDown}
      >
        Загрузить CSV
      </label>
      <input
        ref={inputRef}
        id="csv-file"
        type="file"
        accept=".csv,text/csv"
        disabled={importing}
        hidden
        onChange={handleChange}
      />

      {metadata ? (
        <p>
          <span>{metadata.fileName}</span>{' '}
          <span>
            Экспорт от <time dateTime={metadata.exportDate}>{formatExportDate(metadata.exportDate)}</time>
          </span>
        </p>
      ) : null}

      <p role="status" aria-live="polite">
        {importing ? 'Обрабатываем…' : ''}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {dragActive ? <div>Отпустите CSV-файл</div> : null}
    </section>
  );
}
