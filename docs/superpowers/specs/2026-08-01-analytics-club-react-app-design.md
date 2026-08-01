# Analytics Club React Application Design

## Context

The current club dashboard is a single HTML file with a prepared JSON dataset embedded in its script. Updating it requires an external conversion step and rewriting the HTML. The replacement must be a maintainable React application where the user can load future bot member exports in the same CSV format and see the dashboard update immediately.

The CSV contains personal data, including names, Telegram usernames, phone numbers, and email addresses. A published copy of the application must never include member data or upload it to a server.

## Goals

- Replace the single-file dashboard with a React, Vite, and TypeScript application.
- Let the user select or drag-and-drop a CSV export matching the current schema.
- Validate, transform, and analyze the CSV entirely in the browser.
- Preserve the current visual design, information hierarchy, filters, and table behavior.
- Save the last successfully processed dataset locally and restore it after a reload.
- Produce a static build suitable for Sites, with Vercel as a fallback host.
- Keep parsing, analytics, persistence, and presentation independently testable.

## Non-goals

- No backend, accounts, authentication, shared database, or cross-device synchronization.
- No upload history or comparison between historical exports.
- No CSV column-mapping interface; imports use the established export schema.
- No raw CSV or current member dataset is bundled into the production build.
- No redesign of the existing dashboard aesthetic.

## Technical Architecture

The application is a single-page client application built with React, Vite, and TypeScript. It has no router and makes no network requests with member data.

The system is divided into four boundaries:

1. **CSV import** reads UTF-8 files, parses rows, validates the schema, and produces normalized paid-member records.
2. **Analytics** accepts normalized records and returns all dashboard statistics and chart series as a pure derived model.
3. **Persistence** stores the last successful normalized dataset and import metadata in IndexedDB behind a small repository interface.
4. **Presentation** renders the importer, KPI cards, narrative insight, charts, filters, and member table from the derived dashboard model.

The parser and analytics modules contain no React or browser-storage dependencies. This keeps the calculation contract auditable and allows direct unit testing.

## CSV Contract

The importer requires these columns:

- `USER_ID`
- `registration`
- `username`
- `name`
- `ref_link`
- `phone`
- `email`
- `comment`
- `active`
- `plan`
- `end_date`
- `use_trial`
- `recurrent`
- `tags`
- `pay_count`
- `pay_last`
- `pay_1st`

Additional columns are allowed and ignored. Column order is not significant.

A row enters the paid-member dashboard only when `pay_count`, `pay_1st`, and `end_date` are all present and `pay_count` is a positive integer. Trial-only registrations remain outside the dashboard, matching the current behavior.

For every included row:

- `USER_ID` is required and must be unique among included rows.
- `active` must be either `"1"` or `"0"`; `"1"` maps to `active` and `"0"` maps to `churned`.
- `username` is displayed with a leading `@` when present.
- `phone` remains a string so international prefixes and leading characters are preserved.
- `pay_1st` and `end_date` must be valid ISO-like date-time values from the export.
- Membership lifetime is the whole-day difference between `end_date` and `pay_1st`.
- `recurrent === "+"` identifies an active recurring payment.

The CSV is parsed with a maintained browser-compatible parser rather than a hand-written delimiter splitter, so quoted names, commas, and Unicode are handled correctly.

## Analytics Contract

The dashboard model contains:

- total paid members;
- active and churned counts;
- retention as `active / total * 100`, rounded to one decimal;
- average active and churned lifetime, truncated to a whole number of days to match the current dashboard;
- average active and churned payment count, rounded to one decimal;
- active recurring-payment count;
- active and churned plan distributions;
- monthly joins grouped by the month of `pay_1st`;
- monthly churn grouped by the month of `end_date` for churned members;
- churned members with one payment or less.

The month series is the chronological union of months found in joins and churn, with zeroes inserted where one side has no records. Plan distributions are ordered by descending count. The narrative insight is derived from the current statistics and never assumes that a plan has zero churn.

## Import and Persistence Flow

1. On startup, the application reads the latest supported record from IndexedDB.
2. If a valid cached record exists, the dashboard is restored. Otherwise an empty import state is shown.
3. The user chooses a `.csv` file or drops it anywhere on the page.
4. The application reads and parses the file in the browser.
5. Schema and row validation run before any visible or persistent dataset is replaced.
6. The analytics model is calculated in memory.
7. The normalized records and import metadata are written to IndexedDB.
8. React state switches to the new dataset and the entire dashboard updates immediately.

Only one dataset is retained. A new successful import replaces the previous one. The raw CSV text is not stored after processing.

The persistence record includes:

- a schema version;
- normalized member records;
- original file name;
- resolved export date;
- local import timestamp.

If the file name contains `YYYY-MM-DD`, that value becomes the displayed export date. Otherwise the local import date is used. Unsupported future persistence versions are ignored safely and lead to the empty import state.

## Error Handling

An unsuccessful import must not replace either the current React state or the cached working dataset.

The import panel displays concise Russian-language errors for:

- a non-CSV file;
- unreadable or non-UTF-8 content;
- missing required columns;
- missing or duplicate paid-member `USER_ID` values;
- an `active` value other than `0` or `1` for a paid member;
- invalid or non-positive `pay_count` values;
- invalid required dates;
- a file with no valid paid members.

The error includes a short action, such as exporting the file again or checking the listed columns. It does not echo full member rows or other personal data.

## Interface Design

The existing dark dashboard remains the visual source of truth: near-black page background, dark cards, green active accents, red churn accents, blue secondary accents, compact typography, rounded panels, and a dense scrollable table.

The only new persistent UI is a compact import control in the header containing:

- `Загрузить CSV` action;
- current file name;
- displayed export date;
- a subtle success or error status.

Dragging a file over the page shows a restrained full-page drop overlay using the same colors and border language. No modal confirmation is required: a valid file applies immediately, while an invalid file leaves the current dashboard intact.

The dashboard retains:

- six KPI cards;
- the derived narrative insight;
- monthly join/churn visualization;
- active-plan distribution;
- name, Telegram, and phone search;
- all, active, and churned tabs;
- the existing sort options and sortable headers;
- record count and a vertically scrollable member table.

On narrow screens, cards become a single column and the table scrolls horizontally. Upload controls remain keyboard accessible, focus styles remain visible, and status information is not communicated by color alone. React text rendering is used for member-provided values so names and contact fields cannot inject HTML.

## Performance

For the current dataset size, the application renders the complete table inside its existing scroll container. Search input is deferred and derived filtering and sorting are memoized. Table rows use stable `USER_ID` keys, and off-screen row rendering may use CSS `content-visibility` without changing the visible design.

No heavy charting dependency is required. The existing compact bar and distribution visuals are recreated with React, CSS, and accessible labels. This keeps the static bundle small and avoids loading code unrelated to the dashboard.

## Testing Strategy

Vitest covers pure parser and analytics behavior. React Testing Library covers the importer and dashboard interactions. Browser-level coverage verifies the complete import flow.

Required tests include:

- quoted, Unicode, and comma-containing CSV values parse correctly;
- a synthetic non-sensitive CSV fixture produces its expected normalized row count and aggregate statistics;
- missing columns, invalid dates, invalid payment counts, duplicates, and empty paid selections are rejected;
- invalid imports preserve the previously displayed and persisted dataset;
- successful imports replace the dataset and persist metadata;
- cached data restores on startup;
- search, status filters, and sorting return the expected records;
- the upload control works through both file selection and drag-and-drop;
- the production build contains no bundled member fixture or source CSV.

Automated checks are `typecheck`, `lint`, unit/component tests, the production build, and one browser smoke test using a generated non-sensitive CSV fixture. A local acceptance check may additionally use the user-provided export, but that file and its derived member data must never be copied into the repository or committed.

## Privacy and Deployment

The published artifact contains application code only. Member data stays in the browser profile where it was imported. The application does not call analytics, logging, storage, or other third-party endpoints with file contents or derived member records.

Sites is the primary deployment target. Because the output is a conventional static Vite build, Vercel is the fallback without application-code changes. Deployment documentation must state that browser storage is local to a browser profile and is not encrypted at rest by the application.

## Acceptance Criteria

- Running the application with no cache shows a clear CSV import state and no member data.
- Loading a valid export updates every dashboard section without a page reload.
- Reloading restores the last successful import on the same browser profile.
- Loading an invalid export shows an actionable error and preserves the current dashboard.
- All existing dashboard statistics, filters, sorts, and table fields remain available.
- The visual result clearly matches the current dashboard rather than introducing a redesign.
- A production build is static, contains no real member data, and can be hosted on Sites or Vercel.
- Type checking, linting, automated tests, the production build, and the browser smoke test pass.
