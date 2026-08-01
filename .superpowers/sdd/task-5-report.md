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
