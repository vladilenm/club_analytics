import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImportMetadata } from '../storage/snapshotRepository';
import { ImportControl } from './ImportControl';

afterEach(cleanup);

const metadata: ImportMetadata = {
  fileName: 'members-2026-08-01.csv',
  exportDate: '2026-08-01',
  importedAt: '2026-08-01T12:00:00.000Z',
};

function renderControl(overrides: Partial<React.ComponentProps<typeof ImportControl>> = {}) {
  const onFile = vi.fn();
  const view = render(
    <ImportControl
      metadata={null}
      importing={false}
      error={null}
      onFile={onFile}
      {...overrides}
    />,
  );
  return { onFile, ...view };
}

function fileDrag(file?: File) {
  return {
    dataTransfer: {
      types: ['Files'],
      files: file ? [file] : [],
    },
  };
}

describe('ImportControl', () => {
  it('uses the visible action to activate a hidden CSV input', async () => {
    const user = userEvent.setup();
    renderControl();
    const input = screen.getByLabelText('Загрузить CSV');
    const onClick = vi.fn();
    input.addEventListener('click', onClick);

    await user.click(screen.getByRole('button', { name: 'Загрузить CSV' }));

    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.csv,text/csv');
    expect(input).toHaveAttribute('hidden');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('activates the hidden input with %s', async (_keyName, key) => {
    const user = userEvent.setup();
    renderControl();
    const input = screen.getByLabelText('Загрузить CSV');
    const action = screen.getByText('Загрузить CSV');
    const onClick = vi.fn();
    input.addEventListener('click', onClick);

    action.focus();
    await user.keyboard(key);

    expect(action).toHaveFocus();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders the current filename and Russian export date', () => {
    renderControl({ metadata });

    expect(screen.getByText('members-2026-08-01.csv')).toBeInTheDocument();
    expect(screen.getByText('1 августа 2026 г.', { exact: false })).toBeInTheDocument();
  });

  it('clears the input so the same selected file can be imported again', async () => {
    const user = userEvent.setup();
    const { onFile } = renderControl();
    const input = screen.getByLabelText('Загрузить CSV');
    const file = new File(['csv'], 'members.csv', { type: 'text/csv' });

    await user.upload(input, file);
    await user.upload(input, file);

    expect(onFile).toHaveBeenCalledTimes(2);
    expect(input).toHaveValue('');
  });

  it('shows the drop prompt without flicker and imports a dropped file once', () => {
    const { onFile } = renderControl();
    const file = new File(['csv'], 'members.csv', { type: 'text/csv' });

    fireEvent.dragEnter(document, fileDrag(file));
    fireEvent.dragEnter(document, fileDrag(file));
    expect(screen.getByText('Отпустите CSV-файл')).toBeInTheDocument();

    fireEvent.dragLeave(document, fileDrag(file));
    expect(screen.getByText('Отпустите CSV-файл')).toBeInTheDocument();

    fireEvent.dragLeave(document, fileDrag(file));
    expect(screen.queryByText('Отпустите CSV-файл')).not.toBeInTheDocument();

    fireEvent.dragEnter(document, fileDrag(file));
    fireEvent.drop(document, fileDrag(file));
    expect(onFile).toHaveBeenCalledOnce();
    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.queryByText('Отпустите CSV-файл')).not.toBeInTheDocument();
  });

  it('ignores drags that do not contain a file', () => {
    const { onFile } = renderControl();
    const textDrag = { dataTransfer: { types: ['text/plain'], files: [] } };

    fireEvent.dragEnter(document, textDrag);
    fireEvent.drop(document, textDrag);

    expect(screen.queryByText('Отпустите CSV-файл')).not.toBeInTheDocument();
    expect(onFile).not.toHaveBeenCalled();
  });

  it('removes document drag-and-drop listeners when unmounted', () => {
    const file = new File(['csv'], 'members.csv', { type: 'text/csv' });
    const { onFile, unmount } = renderControl();

    unmount();
    fireEvent.dragEnter(document, fileDrag(file));
    fireEvent.drop(document, fileDrag(file));

    expect(onFile).not.toHaveBeenCalled();
  });

  it('disables importing interactions and announces progress', () => {
    renderControl({ importing: true });

    expect(screen.getByLabelText('Загрузить CSV')).toBeDisabled();
    expect(screen.getByText('Загрузить CSV')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Обрабатываем…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders import errors as an alert', () => {
    renderControl({ error: 'Не удалось обработать CSV.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось обработать CSV.');
  });
});
