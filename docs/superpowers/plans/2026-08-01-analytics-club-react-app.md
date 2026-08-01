# Analytics Club React Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a privacy-preserving React dashboard that imports the established member CSV format in the browser, calculates the existing club metrics, restores the latest successful import locally, and produces a static deployable build.

**Architecture:** Pure TypeScript modules parse and analyze CSV data, an injected IndexedDB repository persists one versioned snapshot, and React renders the existing dashboard design from that snapshot. Imports validate and calculate completely before replacing either visible or persisted state, so failures preserve the last working dashboard.

**Tech Stack:** React, Vite, TypeScript, Papa Parse, IndexedDB through `idb-keyval`, Vitest, React Testing Library, ESLint, and Playwright.

## Global Constraints

- The production build must contain application code only: no real CSV, embedded member JSON, phone numbers, Telegram usernames, or other member records.
- CSV contents and derived records must never be sent over the network.
- Processing and persistence happen entirely in the browser; there is no router, backend, account, or cross-device synchronization.
- Only the last successful normalized dataset is stored, in IndexedDB; raw CSV text is discarded.
- The existing dark dashboard visual design, six KPIs, insight, charts, filters, sorting, and scrollable table must remain recognizable.
- The required CSV schema and calculations are defined in `docs/superpowers/specs/2026-08-01-analytics-club-react-app-design.md`.
- Automated fixtures must be synthetic and non-sensitive. The user-provided export may be used only for a local acceptance check and must never enter Git.
- Every behavior change follows red-green-refactor: write one focused failing test, observe the expected failure, implement the minimum behavior, and rerun the focused and full suites.
- Commit `package-lock.json`; do not add a charting, routing, state-management, or backend dependency.

## Target File Map

```text
index.html                         Vite entry document
package.json                       scripts and dependencies
eslint.config.js                   TypeScript/React lint rules
playwright.config.ts               browser smoke-test configuration
tsconfig.json                      project references
tsconfig.app.json                  browser TypeScript options
tsconfig.node.json                 Vite/Playwright TypeScript options
vite.config.ts                     Vite and Vitest configuration
src/main.tsx                       React bootstrap
src/App.tsx                        boot, import state, and page composition
src/styles.css                     preserved dashboard visual system
src/domain/member.ts               normalized member model
src/domain/importError.ts          stable import error codes and Russian messages
src/domain/csv/parseMembersCsv.ts  CSV schema validation and normalization
src/domain/analytics.ts            pure dashboard calculations
src/domain/queryMembers.ts         search, status filtering, and sorting
src/import/importCsvFile.ts        file decoding and atomic import use case
src/storage/snapshotRepository.ts  versioned IndexedDB boundary
src/components/ImportControl.tsx   file picker, status, and drop overlay
src/components/Dashboard.tsx       dashboard section composition
src/components/KpiGrid.tsx         six summary cards
src/components/Insight.tsx         data-driven narrative
src/components/ActivityChart.tsx   monthly joins/churn bars
src/components/PlanDistribution.tsx active plan distribution
src/components/MembersTable.tsx    search, filters, sorting, and table
src/test/setup.ts                  jest-dom setup and IndexedDB cleanup
src/test/csvFixture.ts             synthetic CSV builder
e2e/dashboard.spec.ts              public user-flow smoke test
e2e/fixtures/members.csv           synthetic browser-test CSV
README.md                          run, privacy, import, and deployment notes
```

---

### Task 1: Project Foundation and CSV Domain Parser

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `src/test/setup.ts`
- Create: `src/test/csvFixture.ts`
- Create: `src/domain/member.ts`
- Create: `src/domain/importError.ts`
- Create: `src/domain/csv/parseMembersCsv.test.ts`
- Create: `src/domain/csv/parseMembersCsv.ts`

**Interfaces:**
- Consumes: the CSV contract in the approved design specification.
- Produces: `MemberRecord`, `ImportError`, `parseMembersCsv(csvText: string): MemberRecord[]`, and reusable synthetic CSV helpers.

- [ ] **Step 1: Initialize package metadata and install the exact dependency families**

Run:

```bash
npm init -y
npm install react react-dom papaparse idb-keyval
npm install -D typescript vite @vitejs/plugin-react @types/node @types/react @types/react-dom @types/papaparse vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals playwright @playwright/test fake-indexeddb
npm pkg set type=module scripts.dev="vite" scripts.build="tsc -b && vite build" scripts.typecheck="tsc -b --pretty false" scripts.lint="eslint ." scripts.test="vitest run" scripts.test:watch="vitest" scripts.test:e2e="playwright test" scripts.check="npm run typecheck && npm run lint && npm run test && npm run build"
```

Expected: `package.json` and `package-lock.json` exist; install exits 0 with no unresolved peer dependency.

- [ ] **Step 2: Create the minimal Vite, TypeScript, lint, and test configuration**

Use these exact configuration contracts:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
```

```json
// tsconfig.json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

```json
// tsconfig.app.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

```json
// tsconfig.node.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

`src/test/setup.ts` must import `@testing-library/jest-dom/vitest` and `fake-indexeddb/auto`. `index.html` must contain only the root element and `/src/main.tsx` module script, with Russian language metadata and the title `Клуб Незаменимых — участники`.

Create this flat lint configuration:

```js
// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
```

- [ ] **Step 3: Write the synthetic CSV helper and failing parser tests**

Create `src/test/csvFixture.ts` with a `makeCsv(rows)` helper using `Papa.unparse`, the exact 17 required headers from the specification, and a `makeRawMember(overrides)` factory whose defaults describe one synthetic active paid member.

Create focused tests with these assertions:

```ts
import { describe, expect, it } from 'vitest';
import { makeCsv, makeRawMember } from '../../test/csvFixture';
import { ImportError } from '../importError';
import { parseMembersCsv } from './parseMembersCsv';

describe('parseMembersCsv', () => {
  function expectImportCode(run: () => unknown, code: ImportError['code']) {
    try {
      run();
      expect.fail('Expected import validation to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ImportError);
      expect((error as ImportError).code).toBe(code);
    }
  }

  it('normalizes quoted Unicode paid-member data and ignores trial-only rows', () => {
    const csv = makeCsv([
      makeRawMember({ USER_ID: 'i1', name: 'Иван, 🚀', phone: '+79000000001' }),
      makeRawMember({ USER_ID: 'i2', use_trial: '+', active: '', plan: '', pay_count: '', pay_1st: '', end_date: '' }),
    ]);

    expect(parseMembersCsv(csv)).toEqual([
      expect.objectContaining({
        id: 'i1', name: 'Иван, 🚀', phone: '+79000000001',
        telegram: '@synthetic_user', status: 'active', paymentCount: 1,
        lifetimeDays: 30, recurrent: true,
      }),
    ]);
  });

  it.each([
    ['INVALID_STATUS', { active: 'yes' }],
    ['INVALID_PAYMENT_COUNT', { pay_count: 'x' }],
    ['INVALID_DATE', { end_date: 'not-a-date' }],
  ] as const)('throws %s for invalid paid data', (code, override) => {
    expectImportCode(() => parseMembersCsv(makeCsv([makeRawMember(override)])), code);
  });

  it('rejects duplicate paid USER_ID values', () => {
    const row = makeRawMember({ USER_ID: 'duplicate' });
    expectImportCode(
      () => parseMembersCsv(makeCsv([row, row])),
      'DUPLICATE_USER_ID',
    );
  });

  it('rejects a file with missing required columns', () => {
    expectImportCode(() => parseMembersCsv('USER_ID,name\ni1,Test'), 'MISSING_COLUMNS');
  });

  it('rejects partially populated payment data', () => {
    const partial = makeRawMember({ pay_count: '1', pay_1st: '', end_date: '' });
    expectImportCode(
      () => parseMembersCsv(makeCsv([partial])),
      'INCOMPLETE_PAYMENT_DATA',
    );
  });

  it('requires USER_ID for a paid member', () => {
    expectImportCode(
      () => parseMembersCsv(makeCsv([makeRawMember({ USER_ID: '' })])),
      'MISSING_USER_ID',
    );
  });

  it('rejects a file with no paid members', () => {
    const trial = makeRawMember({ active: '', plan: '', pay_count: '', pay_1st: '', end_date: '' });
    expectImportCode(
      () => parseMembersCsv(makeCsv([trial])),
      'NO_PAID_MEMBERS',
    );
  });
});
```

- [ ] **Step 4: Run the parser test and verify RED**

Run: `npm test -- src/domain/csv/parseMembersCsv.test.ts`

Expected: FAIL because `member.ts`, `importError.ts`, and `parseMembersCsv.ts` do not exist.

- [ ] **Step 5: Implement the normalized member and import-error contracts**

Use these exported types:

```ts
export type MemberStatus = 'active' | 'churned';

export interface MemberRecord {
  id: string;
  name: string;
  telegram: string;
  phone: string;
  startedAt: string;
  endsAt: string;
  startedAtMs: number;
  endsAtMs: number;
  status: MemberStatus;
  plan: string;
  paymentCount: number;
  lifetimeDays: number;
  recurrent: boolean;
}
```

`ImportError` must extend `Error` and expose one of these stable codes: `NOT_CSV`, `UNREADABLE_FILE`, `INVALID_ENCODING`, `CSV_PARSE_ERROR`, `MISSING_COLUMNS`, `INCOMPLETE_PAYMENT_DATA`, `MISSING_USER_ID`, `DUPLICATE_USER_ID`, `INVALID_STATUS`, `INVALID_PAYMENT_COUNT`, `INVALID_DATE`, or `NO_PAID_MEMBERS`. Map every code to a concise Russian message without including row contents.

- [ ] **Step 6: Implement the minimal parser**

`parseMembersCsv.ts` must:

1. Parse with `Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: 'greedy', transformHeader: value => value.trim() })`.
2. Reject parser errors with `CSV_PARSE_ERROR`.
3. Compare `meta.fields` to all 17 required headers and report the missing names through `MISSING_COLUMNS`.
4. Trim every consumed value.
5. Ignore a row only when `pay_count`, `pay_1st`, and `end_date` are all empty; reject a partially populated trio with `INCOMPLETE_PAYMENT_DATA`.
6. Require unique non-empty `USER_ID`, status `0` or `1`, and a positive integer `pay_count`.
7. Parse `YYYY-MM-DD HH:mm:ss` and ISO equivalents deterministically as UTC, output ISO strings, and calculate `Math.floor((endsAtMs - startedAtMs) / 86_400_000)`.
8. Reject negative lifetimes through `INVALID_DATE`.
9. Prefix a non-empty username with `@` only when it does not already start with `@`.
10. Throw `NO_PAID_MEMBERS` after processing when no paid records remain.

- [ ] **Step 7: Verify GREEN and static checks**

Run:

```bash
npm test -- src/domain/csv/parseMembersCsv.test.ts
npm run typecheck
npm run lint
```

Expected: parser tests PASS; typecheck and lint exit 0.

- [ ] **Step 8: Commit the parser slice**

```bash
git add package.json package-lock.json index.html tsconfig*.json vite.config.ts eslint.config.js src/test src/domain
git commit -m "feat: parse member csv exports"
```

---

### Task 2: Dashboard Analytics and Member Queries

**Files:**
- Create: `src/domain/analytics.test.ts`
- Create: `src/domain/analytics.ts`
- Create: `src/domain/queryMembers.test.ts`
- Create: `src/domain/queryMembers.ts`

**Interfaces:**
- Consumes: `MemberRecord` from Task 1.
- Produces: `DashboardModel`, `buildDashboardModel(members)`, `buildInsight(model)`, `queryMembers(members, query)`, and stable sort/filter types.

- [ ] **Step 1: Write failing analytics tests**

Define four synthetic members covering two statuses, two plans, recurring/non-recurring states, two join months, and two churn months. Assert the complete model:

```ts
expect(buildDashboardModel(members)).toMatchObject({
  stats: {
    total: 4, active: 2, churned: 2, retention: 50,
    averageActiveLifetime: 122, averageChurnedLifetime: 105,
    averageActivePayments: 1.5, averageChurnedPayments: 1.5,
    recurringActive: 1, onePaymentChurned: 1,
  },
  activePlans: [
    { plan: '1 месяц 💬', count: 1 },
    { plan: '6 месяцев (выгода 15%) 💬', count: 1 },
  ],
});
expect(buildDashboardModel(members).months).toEqual([
  { month: '2026-01', joins: 2, churn: 0 },
  { month: '2026-02', joins: 2, churn: 1 },
  { month: '2026-03', joins: 0, churn: 1 },
]);
```

Also assert that `buildInsight` mentions the actual longer-plan churn count rather than claiming it is zero.
Add a separate all-active dataset assertion that churned averages and churn counts are `0`, preventing divide-by-zero or `NaN` output for an empty cohort.

- [ ] **Step 2: Run analytics tests and verify RED**

Run: `npm test -- src/domain/analytics.test.ts`

Expected: FAIL with missing `analytics.ts` exports.

- [ ] **Step 3: Implement pure analytics**

Export these contracts:

```ts
export interface DashboardStats {
  total: number; active: number; churned: number; retention: number;
  averageActiveLifetime: number; averageChurnedLifetime: number;
  averageActivePayments: number; averageChurnedPayments: number;
  recurringActive: number; onePaymentChurned: number;
}
export interface MonthPoint { month: string; joins: number; churn: number }
export interface PlanPoint { plan: string; count: number }
export interface DashboardModel {
  stats: DashboardStats;
  months: MonthPoint[];
  activePlans: PlanPoint[];
  churnedPlans: PlanPoint[];
}
export function buildDashboardModel(members: readonly MemberRecord[]): DashboardModel;
export function buildInsight(model: DashboardModel): string;
```

Use one loop to accumulate counts and sums, `Math.trunc` for lifetime averages, one-decimal rounding for payment averages and retention, chronological `YYYY-MM` keys, zero-filled month union, and descending plan counts with `localeCompare('ru')` as the tie-breaker. Every average helper returns `0` when its cohort count is zero.

- [ ] **Step 4: Verify analytics GREEN**

Run: `npm test -- src/domain/analytics.test.ts`

Expected: all analytics tests PASS.

- [ ] **Step 5: Write failing query tests**

Test `queryMembers` with exact input and output IDs for:

- case-insensitive search across name, Telegram, and phone;
- `all`, `active`, and `churned` filters;
- end date descending and ascending;
- start date ascending and descending;
- lifetime and payment count descending;
- Russian name ascending;
- input-array immutability.

The public query contract is:

```ts
export type StatusFilter = 'all' | 'active' | 'churned';
export type SortKey = 'endsAt' | 'startedAt' | 'lifetimeDays' | 'paymentCount' | 'name';
export type SortDirection = 'asc' | 'desc';
export interface MemberQuery {
  search: string;
  status: StatusFilter;
  sortKey: SortKey;
  sortDirection: SortDirection;
}
```

- [ ] **Step 6: Run query tests and verify RED**

Run: `npm test -- src/domain/queryMembers.test.ts`

Expected: FAIL because `queryMembers.ts` does not exist.

- [ ] **Step 7: Implement and verify member queries**

Implement `queryMembers(members, query): MemberRecord[]` using `filter` followed by `sort` on the new filtered array, numeric comparison for timestamps/counts, and `localeCompare('ru', { sensitivity: 'base' })` for names. Normalize search with `trim().toLocaleLowerCase('ru')`; never sort the input array in place.

Run: `npm test -- src/domain/queryMembers.test.ts src/domain/analytics.test.ts`

Expected: both suites PASS.

- [ ] **Step 8: Commit analytics and queries**

```bash
git add src/domain/analytics* src/domain/queryMembers*
git commit -m "feat: calculate club dashboard metrics"
```

---

### Task 3: Versioned IndexedDB Snapshot Repository

**Files:**
- Create: `src/storage/snapshotRepository.test.ts`
- Create: `src/storage/snapshotRepository.ts`

**Interfaces:**
- Consumes: `MemberRecord` from Task 1.
- Produces: `ImportMetadata`, `DashboardSnapshot`, `SnapshotRepository`, `createSnapshotRepository(adapter)`, and the production `snapshotRepository`.

- [ ] **Step 1: Write failing repository tests**

Use an in-memory `Map` adapter and assert:

```ts
const repository = createSnapshotRepository(memoryAdapter);
await repository.save(snapshot);
expect(await repository.load()).toEqual(snapshot);
await repository.clear();
expect(await repository.load()).toBeNull();
```

Add a test that seeds `{ schemaVersion: 999 }` and expects `load()` to return `null`. Add a test that rejects structurally incomplete version-1 data instead of returning it.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm test -- src/storage/snapshotRepository.test.ts`

Expected: FAIL because the repository module does not exist.

- [ ] **Step 3: Implement the repository boundary**

Use these exact contracts:

```ts
export interface ImportMetadata {
  fileName: string;
  exportDate: string;
  importedAt: string;
}
export interface DashboardSnapshot {
  schemaVersion: 1;
  members: MemberRecord[];
  metadata: ImportMetadata;
}
export interface KeyValueAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}
export interface SnapshotRepository {
  load(): Promise<DashboardSnapshot | null>;
  save(snapshot: DashboardSnapshot): Promise<void>;
  clear(): Promise<void>;
}
```

The production adapter wraps `idb-keyval` with the single key `analytics-club/latest-snapshot`. Validate the schema version, member array, and all metadata strings on load. Do not store analytics because it is derived from members.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- src/storage/snapshotRepository.test.ts`

Expected: repository tests PASS.

```bash
git add src/storage
git commit -m "feat: persist latest dashboard snapshot"
```

---

### Task 4: Atomic CSV File Import Use Case

**Files:**
- Create: `src/import/importCsvFile.test.ts`
- Create: `src/import/importCsvFile.ts`

**Interfaces:**
- Consumes: `parseMembersCsv`, `DashboardSnapshot`, `SnapshotRepository`, and `ImportError`.
- Produces: `importCsvFile(file, repository, now?): Promise<DashboardSnapshot>` and `resolveExportDate(fileName, fallbackDate): string`.

- [ ] **Step 1: Write failing file-import tests**

Cover these exact outcomes:

```ts
it('imports, dates, and persists a valid CSV before returning it', async () => {
  const file = new File([makeCsv([makeRawMember()])], 'members-2026-08-01.csv', { type: 'text/csv' });
  const snapshot = await importCsvFile(file, repository, () => new Date('2026-08-02T10:00:00Z'));
  expect(snapshot.metadata).toEqual({
    fileName: 'members-2026-08-01.csv',
    exportDate: '2026-08-01',
    importedAt: '2026-08-02T10:00:00.000Z',
  });
  expect(await repository.load()).toEqual(snapshot);
});

it('does not replace the repository after an invalid import', async () => {
  await repository.save(existingSnapshot);
  const file = new File(['bad'], 'members.csv', { type: 'text/csv' });
  await expect(importCsvFile(file, repository)).rejects.toBeInstanceOf(ImportError);
  expect(await repository.load()).toEqual(existingSnapshot);
});
```

Also test a non-`.csv` filename, invalid UTF-8 bytes, and fallback export date `2026-08-02` when the filename has no valid date.

- [ ] **Step 2: Run import tests and verify RED**

Run: `npm test -- src/import/importCsvFile.test.ts`

Expected: FAIL because `importCsvFile.ts` does not exist.

- [ ] **Step 3: Implement file decoding and atomic replacement**

`importCsvFile` must:

1. Reject filenames without a case-insensitive `.csv` suffix using `NOT_CSV`.
2. Read `file.arrayBuffer()` and decode with `new TextDecoder('utf-8', { fatal: true })`; map read and decoding failures separately.
3. Call `parseMembersCsv` and construct a schema-version-1 snapshot.
4. Extract the first valid `20YY-MM-DD` filename token and verify it represents a real calendar date; otherwise use the injected local date formatted as `YYYY-MM-DD`.
5. Await `repository.save(snapshot)` before returning it.
6. Never call `save` after any earlier failure.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- src/import/importCsvFile.test.ts`

Expected: all import tests PASS.

```bash
git add src/import
git commit -m "feat: import csv files atomically"
```

---

### Task 5: React Boot State and Import Control

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.test.tsx`
- Create: `src/App.tsx`
- Create: `src/components/ImportControl.test.tsx`
- Create: `src/components/ImportControl.tsx`

**Interfaces:**
- Consumes: `SnapshotRepository`, production `snapshotRepository`, `importCsvFile`, and `DashboardSnapshot`.
- Produces: `App({ repository? })`, an accessible `ImportControl`, empty/loading/error states, and drag-and-drop behavior.

- [ ] **Step 1: Write failing application-state tests**

Use an injected in-memory repository and assert:

- initial `Загрузка локальных данных…` status while `load()` is pending;
- `Загрузите CSV` empty state when `load()` returns `null`;
- cached filename and dashboard heading when `load()` returns a snapshot;
- a successful file selection replaces the filename and calls `save` once;
- an invalid second import displays its Russian error while the first dataset remains rendered.

Use `userEvent.upload(screen.getByLabelText('Загрузить CSV'), file)` rather than calling component handlers directly.

- [ ] **Step 2: Run App tests and verify RED**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because `App.tsx` and `main.tsx` do not exist.

- [ ] **Step 3: Implement App state with repository injection**

Use this public component contract:

```ts
export interface AppProps { repository?: SnapshotRepository }
export type AppPhase = 'loading' | 'ready-empty' | 'ready-data' | 'importing';
```

The state machine has `loading`, `ready-empty`, `ready-data`, and `importing` phases plus a non-destructive error string. Load exactly once per repository. During import, keep the current snapshot visible, disable the picker, await `importCsvFile`, then replace the snapshot on success or keep it on failure. Derive analytics with `useMemo` only when a snapshot exists.

`main.tsx` must mount `<App />` into `#root` inside `StrictMode` and import `styles.css` only after that file exists in Task 7; until then omit the CSS import so tests and typecheck remain green.

- [ ] **Step 4: Write failing ImportControl interaction tests**

Assert that:

- the visible button activates the hidden `.csv` input;
- the current filename and formatted Russian export date render;
- `dragenter` displays `Отпустите CSV-файл`, `dragleave` removes it, and dropping a file calls `onFile` once;
- a non-file drag does not call `onFile`;
- importing state disables the control and announces `Обрабатываем…` through an `aria-live` region.

- [ ] **Step 5: Implement ImportControl and page-wide drop handlers**

Use semantic `<label>` and `<input type="file" accept=".csv,text/csv">`, keep a drag-depth counter in a ref to avoid overlay flicker, and expose:

```ts
interface ImportControlProps {
  metadata: ImportMetadata | null;
  importing: boolean;
  error: string | null;
  onFile(file: File): void;
}
```

Clear the input value after each change so selecting the same file again triggers a new import.

- [ ] **Step 6: Verify React boot and import GREEN**

Run:

```bash
npm test -- src/App.test.tsx src/components/ImportControl.test.tsx
npm run typecheck
```

Expected: both suites PASS and typecheck exits 0.

- [ ] **Step 7: Commit the application shell**

```bash
git add src/main.tsx src/App* src/components/ImportControl*
git commit -m "feat: add local csv import experience"
```

---

### Task 6: Dashboard Presentation and Table Interactions

**Files:**
- Create: `src/components/Dashboard.test.tsx`
- Create: `src/components/Dashboard.tsx`
- Create: `src/components/KpiGrid.tsx`
- Create: `src/components/Insight.tsx`
- Create: `src/components/ActivityChart.tsx`
- Create: `src/components/PlanDistribution.tsx`
- Create: `src/components/MembersTable.test.tsx`
- Create: `src/components/MembersTable.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `MemberRecord`, `DashboardModel`, `buildInsight`, and `queryMembers`.
- Produces: the six KPI cards, insight, charts, searchable/filterable/sortable table, and record count.

- [ ] **Step 1: Write failing dashboard content tests**

Render `Dashboard` with the four-member synthetic dataset from Task 2. Assert the six visible values and labels, the exact active/churned plan counts, the dynamic insight longer-plan count, and monthly bar accessible labels such as `Январь 2026: 2 новых, 0 отмен`.

- [ ] **Step 2: Run dashboard test and verify RED**

Run: `npm test -- src/components/Dashboard.test.tsx`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement dashboard section components**

`Dashboard` accepts `{ members, model }`. `KpiGrid` renders the six approved cards. `Insight` calls `buildInsight(model)`. `ActivityChart` calculates one maximum with a loop, uses CSS percentage heights, displays Russian month labels through `Intl.DateTimeFormat('ru-RU', { month: 'short' })`, and includes full off-screen text for each month. `PlanDistribution` renders active plans with percentage widths and count text; an empty plan total renders an empty state rather than dividing by zero.

- [ ] **Step 4: Verify dashboard content GREEN**

Run: `npm test -- src/components/Dashboard.test.tsx`

Expected: dashboard test PASS.

- [ ] **Step 5: Write failing members-table interaction tests**

Render at least three members with distinguishable names, statuses, dates, and payment counts. Assert:

1. all three appear initially with `3 записи`;
2. searching by mixed-case Telegram narrows to one;
3. clicking `Активные` removes churned rows;
4. choosing `Больше платежей` puts the three-payment row first;
5. clicking the `Имя` header toggles Russian name order;
6. clearing search and returning to `Все` restores all rows.

- [ ] **Step 6: Run table tests and verify RED**

Run: `npm test -- src/components/MembersTable.test.tsx`

Expected: FAIL because `MembersTable.tsx` does not exist.

- [ ] **Step 7: Implement table state and rendering**

Use `useDeferredValue(search)`, `useMemo(() => queryMembers(...))`, and these defaults: `status='all'`, `sortKey='endsAt'`, `sortDirection='desc'`. Keep the current sort dropdown choices and make sortable table headers real buttons with `aria-sort`. Format dates from UTC timestamps as `dd.mm.yyyy`. Use `member.id` as the row key and render member text directly as React text nodes.

Render status filters inside `role="tablist"`; each filter button uses `role="tab"` and `aria-selected`, so the same controls work by pointer, keyboard, and Playwright role queries.

- [ ] **Step 8: Compose Dashboard in App and verify GREEN**

When a snapshot exists, render `<Dashboard members={snapshot.members} model={model} />`; otherwise render the empty import panel. Keep `ImportControl` visible in both states.

Run:

```bash
npm test -- src/components/Dashboard.test.tsx src/components/MembersTable.test.tsx src/App.test.tsx
npm run typecheck
```

Expected: all focused tests PASS and typecheck exits 0.

- [ ] **Step 9: Commit presentation behavior**

```bash
git add src/App.tsx src/components
git commit -m "feat: render interactive member dashboard"
```

---

### Task 7: Preserve the Existing Visual Design and Accessibility

**Files:**
- Create: `src/styles.css`
- Modify: `src/main.tsx`
- Modify: `src/components/ImportControl.test.tsx`
- Modify: `src/components/Dashboard.test.tsx`

**Interfaces:**
- Consumes: semantic classes and sections from Tasks 5–6 and the existing visual reference `club_dashboard_updated.html`.
- Produces: the preserved dark responsive design, visible focus, drag overlay, loading/empty states, and non-color status text.

- [ ] **Step 1: Add failing semantic and accessibility assertions**

Assert that the import button has a visible accessible name, errors use `role="alert"`, asynchronous status uses `aria-live="polite"`, monthly bars have screen-reader labels, active/churned pills include text, and the table remains inside a named scroll region.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/ImportControl.test.tsx src/components/Dashboard.test.tsx`

Expected: FAIL on at least the newly required role, label, or region assertion.

- [ ] **Step 3: Restore the exact visual tokens and structural styles**

Move the non-data CSS rules from the `<style>` block in `club_dashboard_updated.html` into `src/styles.css`; do not copy its `<script>` or embedded member JSON. Preserve these exact core tokens:

```css
:root {
  color-scheme: dark;
  --page: #0a0b0d;
  --panel: #131519;
  --line: #22252b;
  --text: #e8eaed;
  --muted: #7d848d;
  --green: #3ecf8e;
  --red: #f2555a;
  --yellow: #e8b44a;
  --blue: #5b9dff;
}
```

Add exact new-state styling contracts:

```css
.app-header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; margin-bottom:28px; }
.import-control { display:flex; align-items:center; gap:12px; flex-wrap:wrap; justify-content:flex-end; }
.upload-button:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid var(--blue); outline-offset:3px; }
.drop-overlay { position:fixed; inset:16px; z-index:20; display:grid; place-items:center; border:2px dashed var(--blue); border-radius:18px; background:rgba(10,11,13,.94); color:var(--text); font-size:20px; }
.empty-state { min-height:360px; display:grid; place-items:center; text-align:center; border:1px dashed #2a2e35; border-radius:14px; background:var(--panel); }
.member-row { content-visibility:auto; contain-intrinsic-size:44px; }
@media (max-width:900px) { .app-header { flex-direction:column; } .import-control { justify-content:flex-start; } }
```

Import `./styles.css` from `src/main.tsx`.

- [ ] **Step 4: Implement the missing semantic attributes and verify GREEN**

Add only the roles/labels required by Step 1 without changing visible copy. Run:

```bash
npm test -- src/components/ImportControl.test.tsx src/components/Dashboard.test.tsx
npm run lint
npm run typecheck
```

Expected: tests PASS; lint and typecheck exit 0.

- [ ] **Step 5: Commit the visual migration**

```bash
git add src/styles.css src/main.tsx src/components
git commit -m "style: preserve dashboard visual system"
```

---

### Task 8: Browser Smoke Test, Privacy Guard, Documentation, and Production Build

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures/members.csv`
- Create: `e2e/dashboard.spec.ts`
- Create: `scripts/check-dist-privacy.mjs`
- Create: `README.md`
- Modify: `package.json`
- Create: `.gitignore`

**Interfaces:**
- Consumes: the complete application and static Vite build.
- Produces: repeatable browser acceptance coverage, privacy scanning, deployment-ready `dist/`, and operator documentation.

- [ ] **Step 1: Write the failing browser smoke test with a synthetic fixture**

Create `e2e/fixtures/members.csv` with exactly two fictional rows and all 17 required headers: one active recurring monthly member and one churned non-recurring start-plan member. Use reserved contacts `@example_active`, `@example_churned`, `+70000000001`, and `+70000000002`.

Create this user flow:

```ts
import { test, expect } from '@playwright/test';

test('imports a CSV, updates the dashboard, and restores it after reload', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) externalRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByText('Загрузите CSV')).toBeVisible();
  await page.getByLabel('Загрузить CSV').setInputFiles('e2e/fixtures/members.csv');
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('@example_active')).toBeVisible();
  await page.reload();
  await expect(page.getByText('@example_active')).toBeVisible();
  await page.getByRole('tab', { name: 'Отменившие' }).click();
  await expect(page.getByText('@example_churned')).toBeVisible();
  await expect(page.getByText('@example_active')).not.toBeVisible();
  expect(externalRequests).toEqual([]);
});
```

- [ ] **Step 2: Configure Playwright and verify RED**

`playwright.config.ts` must use `baseURL: 'http://127.0.0.1:4173'` and a web server command `npm run dev -- --host 127.0.0.1 --port 4173`, reusing an existing server outside CI.

Run:

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: the browser test PASS because every behavior was introduced through failing unit/component tests in Tasks 1–7. If it fails, stop and use the systematic-debugging skill before changing production code.

- [ ] **Step 3: Record the browser acceptance result**

Run `npm run test:e2e` a second time after a clean browser context and expect `1 passed`. This confirms restoration depends on IndexedDB created during the test rather than state leaked from a previous run.

- [ ] **Step 4: Write a failing production privacy guard**

Create `scripts/check-dist-privacy.mjs` that recursively scans text files under `dist/` and fails when it finds any of:

- the real source filename fragment `members ai_wont_replace_bot`;
- the old embedded-data marker `const D={"rows"`;
- a phone-number-like token matching `/\+\d{10,15}/`;
- any `.csv` file in `dist/`.

It must print only the matched rule and relative build path, never matched content.

Add `"privacy:check": "node scripts/check-dist-privacy.mjs"` and extend `check` to run it after `build`.

Run: `npm run privacy:check`

Expected: FAIL because `dist/` does not exist yet, proving the guard runs and rejects an unverifiable build.

- [ ] **Step 5: Build and verify the privacy guard GREEN**

Run:

```bash
npm run build
npm run privacy:check
```

Expected: Vite build exits 0; privacy guard prints `Production build contains no member dataset` and exits 0.

- [ ] **Step 6: Document operation and prevent sensitive files from entering Git**

Create `.gitignore` with:

```gitignore
node_modules/
dist/
playwright-report/
test-results/
coverage/
__pycache__/
*.pyc
*.csv
!e2e/fixtures/members.csv
club_dashboard_updated.html
```

`README.md` must include exact sections for prerequisites, `npm install`, `npm run dev`, CSV import, local IndexedDB behavior, `npm run check`, `npm run test:e2e`, static `npm run build`, Sites as the primary host, Vercel as fallback, and the warning that browser storage is local to one profile and is not application-encrypted. State explicitly that real exports must not be committed.

- [ ] **Step 7: Run the complete verification suite**

Run:

```bash
npm run check
npm run test:e2e
git status --short
```

Expected: typecheck, lint, all unit/component tests, build, privacy guard, and one Playwright test PASS. Git status shows only the intended Task 8 files plus the pre-existing untracked `update_club_dashboard.py`, which is outside the React production build.

- [ ] **Step 8: Perform local acceptance with the user-provided export without copying it**

Open the running app and select `/Users/vladilen/Downloads/Telegram Desktop/members ai_wont_replace_bot - 2026-07-31.csv` through the browser file input. Confirm the aggregate baseline from the approved export: 766 total, 329 active, 437 churned, and 43.0% retention. Reload and confirm those values restore from IndexedDB. Clear the test browser profile after the acceptance check; do not write the imported dataset into the repository.

- [ ] **Step 9: Commit the verified application**

```bash
git add .gitignore README.md package.json package-lock.json playwright.config.ts e2e scripts src index.html tsconfig*.json vite.config.ts eslint.config.js
git commit -m "test: verify private production dashboard"
```

- [ ] **Step 10: Prepare hosting handoff**

Confirm `dist/index.html` loads through the Vite preview server with no network request containing CSV or member data. The build is then ready for the separate Sites hosting workflow; if Sites rejects a conventional static Vite artifact, deploy the same `dist/` through the Vercel workflow without changing application code.

## Final Acceptance Checklist

- [ ] Empty browser storage shows the importer and zero member data.
- [ ] Valid CSV import updates all six KPIs, insight, charts, plans, table, and metadata without reload.
- [ ] Reload restores the latest successful import in the same browser profile.
- [ ] Invalid CSV import reports a Russian action message and preserves the prior snapshot.
- [ ] Search, status tabs, dropdown sorting, header sorting, and record count work with the synthetic browser fixture.
- [ ] Layout visually matches the original dark dashboard at desktop and mobile widths.
- [ ] No application code sends member data over the network.
- [ ] `dist/` contains no CSV, real member fixture, embedded dataset, or phone-number-like member record.
- [ ] `npm run check` and `npm run test:e2e` pass from a clean install.
- [ ] README documents Sites primary hosting and Vercel fallback.
