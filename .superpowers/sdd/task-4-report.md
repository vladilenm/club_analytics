# Task 4 — Atomic CSV File Import Use Case

## Delivered

- Added `src/import/importCsvFile.ts` with case-insensitive CSV suffix validation, separate unreadable-file and fatal UTF-8 decoding errors, CSV parsing, schema-v1 snapshot creation, filename export-date resolution, and save-before-return semantics.
- Added `src/import/importCsvFile.test.ts` covering successful import/persistence, preservation of an existing snapshot after invalid CSV input, non-CSV files, invalid UTF-8, read failures, and fallback dates.

## TDD evidence

### RED

Command:

```bash
npm test -- src/import/importCsvFile.test.ts
```

Result: failed as expected before implementation. Vite could not resolve `./importCsvFile` from `src/import/importCsvFile.test.ts` because `importCsvFile.ts` did not exist.

### GREEN

Command:

```bash
npm test -- src/import/importCsvFile.test.ts
```

Result: passed — 1 test file, 6 tests.

## Verification

| Command | Result |
| --- | --- |
| `npm test -- src/import/importCsvFile.test.ts` | PASS — 6 tests |
| `npm test` | PASS — 5 files, 36 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | BLOCKED by pre-existing later-task dependency: `index.html` references missing `src/main.tsx` (Task 5 scope), after TypeScript compilation completes. |
| `git diff --check` | PASS |

## Self-review

- `save` is reached only after suffix checking, file reading, UTF-8 decoding, parser validation, timestamp construction, and snapshot construction have completed.
- The invalid-import test saves an existing snapshot first and verifies it remains unchanged after parser rejection.
- `resolveExportDate` scans filename tokens in order, returns the first real calendar date, and uses the injected local date when none is valid.
