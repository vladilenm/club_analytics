# Period analytics implementation plan

**Goal:** Provide five period membership metrics from a separately imported transaction history.

**Architecture:** Pure history parser and interval calculations in `src/period/`, an independently validated IndexedDB snapshot, and a self-contained React section in the existing App. No extra runtime dependencies.

**Tech stack:** TypeScript, React, PapaParse, idb-keyval, Vitest, Testing Library, Playwright.

## Constraints

- Keep real transaction data outside repository/build/test fixtures.
- Preserve existing member import, storage, KPIs and table.
- Mark interval reconstruction as estimates and expose renewal/tariff/gap assumptions.
- Clamp calendar months, include full selected dates, forbid future reporting beyond export.
- Count unique members per metric; preserve working data after invalid replacements.

## Tasks

- [x] Add tests in `src/period/analytics.test.ts` for parsing, month ends, leap years, early renewal in both modes, genuine gaps, repeat returns, unknown tariffs, boundary events, invalid/future ranges.
- [x] Run `npm test -- src/period/analytics.test.ts` and observe missing module failures.
- [x] Add `src/period/model.ts`, `parseTransactionsCsv.ts`, `analytics.ts`; extract the existing strict timestamp parser into `src/domain/csv/parseDate.ts` without changing its semantics.
- [x] Rerun domain tests and existing member CSV tests.
- [x] Add storage/import tests in `src/period/repository.test.ts` covering corrupt cache, round trips, import replacement, UTF-8/date validation and preserved rules. Implement `repository.ts` and `importHistory.ts` after observing failures.
- [x] Implement `PeriodAnalytics.tsx`, `HistoryReport.tsx`, `HistoryRulesForm.tsx` and `useHistory.ts` with scoped CSS in `src/styles.css`. Per user instruction, proceed without TDD; verify selection, metrics, editable assumptions, invalid imports and restoration through browser acceptance after implementation.
- [x] Integrate section into `src/App.tsx` after its initial load. Retain existing status/import semantics.
- [x] Add synthetic in-memory browser coverage in `e2e/period.spec.ts`; update README with input rules, limitations and workflow.
- [x] Run `npm run check` and `npm run test:e2e`; inspect desktop and narrow screenshots. Check supplied CSV through a temporary local acceptance script without copying data into the repo.
- [x] Independently review changed code using requesting-code-review, fix actionable findings, rerun affected checks and inspect `git diff --check`.
