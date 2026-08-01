# Task 5 Report: React Boot State and Import Control

## Outcome

Implemented the React entry point, injected snapshot-repository boot state, non-destructive CSV importing, semantic empty/loading/error states, and an accessible import control with document-wide drag-and-drop.

## TDD evidence

### App RED

Command:

```bash
npm test -- src/App.test.tsx
```

Result: **FAIL**, exit 1. Vitest could not resolve `./App` because `src/App.tsx` did not exist; the suite reported 0 tests, which was the expected initial failure.

### App GREEN

Command:

```bash
npm test -- src/App.test.tsx
```

Result after the minimal App implementation and test-isolation correction: **PASS**, 1 file and 6 tests.

### ImportControl RED

Command:

```bash
npm test -- src/components/ImportControl.test.tsx
```

Result: **FAIL**, exit 1. Vitest could not resolve `./ImportControl` because `src/components/ImportControl.tsx` did not exist; the suite reported 0 tests, which was the expected failure.

### ImportControl GREEN

Command:

```bash
npm test -- src/App.test.tsx src/components/ImportControl.test.tsx
```

Result: **PASS**, 2 files and 13 tests.

### Boot-edge RED/GREEN

Two follow-up regression tests were added for repository identity caching and stable Russian boot errors.

Command:

```bash
npm test -- src/App.test.tsx
```

RED result: **FAIL**, 2 of 8 tests failed for the intended reasons: the raw repository error `storage internals` was rendered, and returning to the first repository called `load()` twice.

After normalizing the boot error and caching load promises by repository identity, the focused command below was GREEN:

```bash
npm test -- src/App.test.tsx src/components/ImportControl.test.tsx
```

Result: **PASS**, 2 files and 15 tests.

### Accessibility review RED/GREEN

A focused keyboard-activation test was added after self-review identified that a fully hidden native input left the visible label mouse-only.

Command:

```bash
npm test -- src/components/ImportControl.test.tsx
```

RED result: **FAIL**, 1 of 8 tests failed because the visible action could not receive focus and Enter did not activate the input. After adding button semantics, focusability, and Enter/Space handling to the label, the final focused App/control run passed 2 files and 16 tests.

## Files

- `src/main.tsx` — mounts `<App />` into `#root` inside `StrictMode`; intentionally has no stylesheet import yet.
- `src/App.tsx` — repository-injected boot/import state machine, render-time analytics derivation, stable error handling, and shell composition.
- `src/App.test.tsx` — loading, empty, cached, boot-error, repository identity, successful import, and non-destructive invalid-import coverage.
- `src/components/ImportControl.tsx` — labeled `.csv` picker, metadata/date rendering, live progress/error regions, input reset, and document-wide drag/drop with depth tracking.
- `src/components/ImportControl.test.tsx` — picker, repeat upload, metadata, nested drag, non-file drag, drop, disabled state, live region, and alert coverage.

## Verification

| Command | Result |
| --- | --- |
| `npm test -- src/App.test.tsx src/components/ImportControl.test.tsx` | PASS — 2 files, 16 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run check` | PASS — typecheck, lint, 7 test files / 52 tests, and production build |
| production build within `npm run check` | PASS — Vite transformed 23 modules and emitted `dist/` |

## Self-review

- `App` exposes the required `AppProps` and `AppPhase` contracts and defaults to the production `snapshotRepository`.
- The boot effect is keyed only by repository identity; a per-instance `WeakMap` deduplicates StrictMode effect replay and revisiting an injected repository.
- Analytics are derived with `useMemo` only when a snapshot exists; interaction-driven imports stay in the file handler.
- Import failure restores `ready-data` or `ready-empty` without clearing the working snapshot. The import use case remains responsible for atomic persistence.
- The picker supports pointer and Enter/Space keyboard activation, disables during import, clears its value after every selection, and exposes progress through a polite live region and failures through an alert.
- Document listeners are installed and cleaned up in the control; a ref-based drag depth prevents nested `dragenter`/`dragleave` flicker.
- No member data, fixtures beyond synthetic test data, network calls, CSS, or new dependencies were added.

## Concerns / deferred scope

- The data-ready section is intentionally a minimal semantic placeholder. Task 6 will supply the full dashboard presentation.
- `styles.css` is intentionally not imported; visual treatment and the final hidden-input styling belong to Task 7.
- No blockers remain for Task 5.

## Fix Review

### Findings addressed

1. A successful import now replaces the cached boot promise for its repository. Switching A → B → A restores the imported A snapshot while `A.load()` remains deduplicated.
2. Import completions now require all three conditions before changing the boot cache or React state: the component is mounted, the repository is still current, and the operation generation is still current. Repository changes, newer imports, and unmount cleanup all advance the generation.
3. Regression coverage now proves that prior metadata/dashboard remain visible and the picker remains disabled while a replacement import is pending.
4. Keyboard coverage now exercises Space as well as Enter.
5. Document-wide drag/drop cleanup is covered behaviorally by dropping after `ImportControl` unmount and asserting that `onFile` is untouched.

### RED evidence

#### Repository round-trip

Command:

```bash
npm test -- src/App.test.tsx
```

Exact result: exit 1; `src/App.test.tsx (9 tests | 1 failed)`. Failure:

```text
FAIL  src/App.test.tsx > App > keeps an imported snapshot when returning to its repository
TestingLibraryElementError: Unable to find an element with the text: round-trip-2026-08-03.csv.
Tests  1 failed | 8 passed (9)
```

Root cause: the per-repository `WeakMap` still held the original resolved `null` boot promise after the import succeeded.

After updating the boot cache on successful import, the same command passed 1 file / 9 tests.

#### Stale A → B → A completion

Command:

```bash
npm test -- src/App.test.tsx
```

Exact result: exit 1; `src/App.test.tsx (12 tests | 1 failed)`. Failure:

```text
FAIL  src/App.test.tsx > App > does not let an older A import overwrite a newer one after A to B to A
Error: expect(element).not.toBeInTheDocument()
expected document not to contain element, found <span>
  stale-2026-08-03.csv
</span> instead
Tests  1 failed | 11 passed (12)
```

Root cause: the async continuation only compared repository identity. Once props returned to A, an older A import again passed that identity check and replaced the newer A state/cache.

### GREEN evidence

Focused command after mounted/repository/generation guards and all requested regressions:

```bash
npm test -- src/App.test.tsx src/components/ImportControl.test.tsx
```

Result: **PASS**, 2 files / 22 tests.

Required covering commands:

| Command | Result |
| --- | --- |
| `npm test -- src/App.test.tsx src/components/ImportControl.test.tsx` | PASS — 2 files, 22 tests |
| `npm test` | PASS — 7 files, 58 tests |
| `npm run typecheck` | PASS — exit 0 |
| `npm run lint` | PASS — exit 0 |
| `npm run build` | PASS — 23 modules transformed; production assets emitted |

### Files changed in review fix

- `src/App.tsx` — refreshes per-repository boot results after current imports and guards async completions with mounted, current-repository, and operation-generation refs.
- `src/App.test.tsx` — adds repository round-trip, stale A → B → A/newer operation, unmount settlement, and pending replacement regressions.
- `src/components/ImportControl.test.tsx` — adds Space activation and post-unmount document drop coverage.
- `.superpowers/sdd/task-5-report.md` — records review findings and exact RED/GREEN evidence.

### Review-fix self-review

- Both success and failure continuations use the same three-part guard; stale failures cannot surface an obsolete error either.
- Cache replacement occurs only after persistence succeeds and only for the current operation, so failed or stale operations do not replace a known boot result.
- Repository changes advance the generation in a layout effect, closing the render-to-passive-effect window before promise continuations can run.
- Unmount cleanup marks the component unmounted and advances the generation before any later import continuation can mutate cache/state.
- Existing StrictMode load deduplication remains intact because the boot-promise `WeakMap` is unchanged and covered by the original test.
- The pending-import regression verifies the non-destructive UI contract at the intermediate state, not only after rejection.
- No production changes were needed in `ImportControl`; its Space handling and listener cleanup were already implemented and are now explicitly covered.

### Remaining concern

- An IndexedDB write already awaited inside `importCsvFile` cannot be cancelled after it has started. The new guards prevent a stale continuation from changing the active React state or boot cache; normal same-view overlap remains prevented by the disabled picker.
