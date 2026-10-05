# Revo Sport: audit and phased delivery

## Current architecture

- React 19, TypeScript, Vite, Tailwind v4. Screens: `src/screens/coach`, `src/screens/student`, `src/screens/Auth.tsx`.
- Global client state: `src/lib/store.tsx`; a localStorage fallback and a remote delta synchronization layer (`src/lib/remote.ts`).
- Node HTTP backend: `server/index.mjs`; one JSON database file and a media directory. The server scopes responses to the authenticated coach/student.
- Models: `src/data/types.ts`; reference exercise/food content: `src/data/library.ts`; new derived calculations in `src/lib/{nutrition,adherence,training}.ts`.

## Features retained

Existing authentication and OTP, coach/student dashboards, workout programming/execution, exercise library and custom videos, progress and sleep tracking, chat, appointments, notifications, subscriptions, mock payment flow, personal settings, and local/remote persistence remain present.

## What changed in this increment (Phase 1, partial)

- Coach nutrition: student meal plans and reusable templates; custom foods; daily calories, protein, carbohydrates, fat, fiber; editable servings; duplicate/delete; plan versions and restoration; drafts and assignments.
- Student nutrition: assigned daily plan, completion of individual meals, calculated consumption vs targets, daily water tracking. Stored as structured records (`MealPlan`, `FoodEntry`, `NutritionLog`).
- Weekly check-in: student submission and coach review/approve/request changes. One record per student and week, server-side scoping and validation.
- Adherence: derived workout/nutrition/check-in/overall percentages, shown on the student dashboard and coach student profile.
- Training: derived volume, sets, repetitions, average RPE, weekly volume and exercise PR history, shown in coach reports and student history.
- Workout program revision snapshots and reusable coach templates. Existing program editor remains in place.
- Server delta API was extended to receive scoped food/meal/check-in/template records. The student can no longer alter subscription fields or invoices through generic delta writes. Mock payment is disabled in remote mode; it remains available as a local demo only.

## Missing features and debt

- **Not production-ready:** the backend is a single JSON file with debounced writes. No ACID transactions, relational constraints, schema migrations, secondary indexes, or horizontal scaling. Migrate to PostgreSQL with versioned migrations before large-scale use.
- **Security:** generic `/api/db` still allows broad updates to some records (including old workout logs, progress and photos); replace with per-entity validated commands and immutable event logs. Media GET is public by identifier; private progress photos need authenticated media endpoints and consent/permission checks. Browser bearer tokens are not HttpOnly cookies. Add CSRF policy if cookies are adopted.
- **Payments:** the existing bank page is a simulation, not a payment provider. A payment may only activate a subscription after provider callback and server-to-server verification. Do not enable mock checkout on a remote server.
- **AI:** the existing assistant is rule-based; there is no model provider, prompt isolation, approval workflow, or auditable AI recommendation storage.
- **Analytics:** current PRs are derived from logs; no immutable PR event table or full per-muscle weekly analytics. Adherence formulas are initial and need product definitions for missed/paused weeks.
- **Other requested work:** progress-photo upload in weekly check-ins, injury conflicts, timestamped form reviews, recovery readiness, attendance and QR, recurring appointments, gym tenancy, granular permission roles, financial reports, PDF generation, challenges, complete audit logs, push/SMS/email providers, and production monitoring.
- **UX:** some screens still need complete loading/error/offline/no-permission states and pagination. The single-file Vite output grows with each feature; route-level code splitting is desirable when deployment constraints permit it.

## Recommended continuation

1. Complete Phase 1: check-in progress-photo uploads using private media; dedicated PR records; formal adherence specifications; detailed per-muscle charts; plan version diff UI and tests.
2. Phase 2: injury/restriction models, recovery, coach notes, substitution, video form-review with timestamp comments, server event-driven notifications and calendar/attendance commands.
3. Phase 3: PostgreSQL migrations, gym/coach/student tenant relations and row-level authorization; replace generic delta API; payment provider with signed webhook verification; financial reporting, PDFs and audit logs.
4. Phase 4: provider-backed AI with scoped structured input, draft approvals, rejection history and safety review; analytics/AI alerts.

## Verification status

- Vite production build: passed.
- TypeScript: editor diagnostics during changes were resolved; a standalone `tsc --noEmit` run has **not** been performed in this environment.
- Lint: no lint script exists in `package.json`, so lint has **not** been run.
- Unit/integration/API/browser tests: not run here; the Node backend was not started in this environment. Do not treat the above as a verified production release.