# Architecture

## Overview

```
Browser ──HTTPS──▶ (same origin) ──▶ Express API ──▶ MongoDB
  React SPA             /api/v1           sessions collection (connect-mongo)
  TanStack Query        Helmet/CORS       users, categories, transactions, budgets
  ShaderGradient (lazy) CSRF + rate limits
```

In development Vite proxies `/api` to the API, so the browser sees one origin. In production the API can serve the built SPA (`SERVE_WEB_DIST`), or the SPA can be hosted separately on the same site (see docs/DEPLOYMENT.md).

## Packages

| Package | Responsibility |
| --- | --- |
| `packages/shared` | Zod request schemas (one source of validation for client and server), DTO types, money parsing in integer minor units, calendar-date helpers, pure financial functions (`summarizeTotals`, `budgetProgress`, `changeBps`, `buildMonthlySeries`). |
| `apps/api` | HTTP layer, sessions, authorisation, persistence, aggregation. |
| `apps/web` | UI. Never calculates totals itself; it formats what the API returns. |

## API structure

```
src/
  config/       env validation (fails fast), logger with redaction, .env loading
  middleware/   session, csrf, auth (requireAuth/authOf), validate (operator rejection, id params), rate limits, errors
  models/       User, Category, Transaction, Budget (+ indexes)
  modules/      auth, users, categories, transactions, budgets, dashboard, reports, exports (one router each)
  services/     aggregates, amounts, passwords, sessions, default categories, DTO mapping
  utils/        HttpError, csv, regex escaping
  scripts/      seed
  test/         harness + integration suites
```

Request pipeline under `/api/v1`: pino-http → Helmet → CORS → rate limit → JSON body (32 kB) → operator-key rejection → session → CSRF → `no-store` → router → `requireAuth` (protected routers) → handler → error handler.

## Key decisions

**Money as integer minor units.** Amounts arrive as decimal strings (`"1250.50"`), are parsed without floating point into integers (`125050`) according to the currency’s minor digits, stored as integers and summed with `$sum`. The largest accepted amount is 1 billion major units, so totals stay far below 2^53. The client only divides for display.

**One currency per account.** Mixing currencies in a total would be wrong without exchange rates, which are out of scope. Currency can change only while the account has no transactions (`409 CURRENCY_LOCKED`).

**Calendar dates, not instants.** A transaction stores `date: "YYYY-MM-DD"` (the day in the user’s own calendar) and a derived `month: "YYYY-MM"`. Monthly reports therefore never shift with server or browser time zones. The user’s `timeZone` preference decides only what “today” and “this month” mean when choosing defaults.

**Ownership by construction.** `requireAuth` resolves the user from the server-side session and exposes `ownerId`; every query, update, delete and aggregation includes `ownerId` from that context. No endpoint accepts an owner id. Records of other users answer `404` exactly like missing records.

**Aggregations.** Pipelines `$match` on `ownerId` first and group by stored fields (`type`, `month`, `categoryId`). Each `$group` has a single accumulator; sums and counts run as two small indexed pipelines. This keeps results identical on MongoDB and on compatible servers that mishandle several accumulators in one stage (observed with FerretDB 1.24 during development).

**Category history.** Categories referenced by transactions or budgets cannot be deleted (`409 CATEGORY_IN_USE`); they can be archived, which hides them from new entries but keeps names in history, reports and exports.

**Server state.** TanStack Query caches per resource; any transaction mutation invalidates transactions, dashboard, budgets and reports. On `401` the client clears every cached financial query.

**Background.** One `ShaderBackground` sits in the root route, so navigation never re-creates the WebGL renderer. The three.js bundle is a separate lazy chunk. See docs/SHADER.md.

## Front-end structure

```
src/
  app/App.tsx            providers + router (lazy signed-in pages)
  components/background  ShaderBackground, ShaderCanvas (lazy), config, effects preference
  components/layout      AppShell (rail, mobile tab bar), Page (horizon + sheet), Wordmark
  components/ui          Button, Field, Dialog/ConfirmDialog, Toast, Money, ProgressBar, Segmented, PeriodPicker, …
  features/<area>        page + feature components per area
  lib/                   api client, query hooks, formatting, periods
```

Visual system: near-black surfaces (`#050807` page, `#080B0A` sheet, `#0D1412` surface), mint `#94FFD1` and cyan `#6BF5FF` accents, Geist Variable with tabular figures. Each signed-in page has a transparent “horizon” over the water (title and the page’s key figure) and an opaque sheet for data. Chart series colours were checked with a palette validator for dark-surface lightness and colour-vision separation (`#2BAA7B` income, `#7C84F0` spending).
