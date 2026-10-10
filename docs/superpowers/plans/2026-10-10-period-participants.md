# Period participants implementation plan

**Goal:** Let the community manager open and export the exact people counted by period event cards.

**Architecture:** Extend the pure period calculation to return unique event participants alongside its existing metrics. Join snapshot contacts by ID in a separate module; render an inline table within HistoryReport. Pass the existing member snapshot through App and PeriodAnalytics without changing either repository schema.

**Tech stack:** React, TypeScript, PapaParse, Vitest, Testing Library, Playwright.

## Constraints

- Preserve existing period boundaries, tariff rules, gap tolerance and unique-person counting.
- Do not infer or change compensation rules from the attached screenshot.
- Keep participants with missing contacts and participants who have since returned.
- Use synthetic test data only. Keep exports local and escape spreadsheet formulas.
- Preserve the existing current-snapshot table; explain why it differs from historical events.

## Tasks

- [x] Add failing regression tests for nine historical departures versus three snapshot cancellations, repeated departures, early returns, missing contacts and exact CSV rows.
- [x] Implement calculatePeriodReport in src/period/analytics.ts; retain calculatePeriod as its metrics-only wrapper. Produce unique participants with all event dates and access at the selected period end.
- [x] Implement contact joining and CSV serialization in src/period/participants.ts. Match on USER_ID; keep every participant; sort by latest event. Include source dates and snapshot status.
- [x] Add failing HistoryReport interaction tests for card clicks, keyboard, empty results, range changes, invalid dates, refreshed contacts and changed calculation rules.
- [x] Implement src/period/PeriodParticipants.tsx, integrate clickable event cards into HistoryReport.tsx, and pass the member snapshot through PeriodAnalytics.tsx and App.tsx. Add scoped CSS and concise source/return explanations.
- [x] Add browser coverage for both CSV imports, exact row counts, exports, source differences, missing contacts, keyboard and narrow viewport.
- [x] Update README; run npm run check, npm run test:e2e and git diff --check. Inspect desktop and mobile screenshots and review the final diff.

## Verification

`npm run check` passed: types, lint, 159 unit tests, 15 privacy guard tests,
production build and build privacy check. `npm run test:e2e` passed all four
browser tests. Desktop and 390px mobile screenshots were inspected. The
requesting-code-review review found no material issues in the tracked changes
or new files. The concrete original 9 / 3 membership cannot be established
without its source CSVs; the same source distinction is reproduced synthetically.
