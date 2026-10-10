# API reference — `/api/v1`

All bodies are JSON. Money in responses is **integer minor units** (`amountMinor: 125050` = 1,250.50). Money in requests is a **decimal string** (`"1250.50"`), parsed exactly on the server. Dates are `YYYY-MM-DD`; months are `YYYY-MM`.

## Conventions

- **Auth**: session cookie (`tf.sid`, HttpOnly). Protected endpoints return `401 UNAUTHENTICATED` (or `SESSION_EXPIRED`).
- **CSRF**: every `POST`/`PATCH`/`DELETE` needs an allowed `Origin` (or `Referer`). When signed in it also needs `X-CSRF-Token: <token>`; the token comes from register, login, `GET /auth/session`, `GET /auth/me` and password change.
- **Errors**: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "amount": "…" } } }`. Codes include `VALIDATION_ERROR`, `INVALID_INPUT`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS`, `CSRF_ORIGIN_REJECTED`, `CSRF_TOKEN_INVALID`, `NOT_FOUND`, `DUPLICATE`, `EMAIL_IN_USE`, `CATEGORY_EXISTS`, `CATEGORY_IN_USE`, `CATEGORY_LIMIT`, `BUDGET_EXISTS`, `CURRENCY_LOCKED`, `EXPORT_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL_ERROR`.
- **Unknown fields are rejected** (400). Keys starting with `$` or containing `.` are rejected anywhere.
- **Other users’ ids** respond `404 NOT_FOUND`, identical to ids that do not exist.

## Health

| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | `{ "status": "ok" }` |

## Auth

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password, currency?, timeZone? }` | `201 { user, csrfToken }` + cookie |
| POST | `/auth/login` | `{ email, password }` | `200 { user, csrfToken }` + new cookie |
| POST | `/auth/logout` | – | `204`, session destroyed |
| GET | `/auth/session` | – | `200 { user: null }` or `{ user, csrfToken }` (never 401) |
| GET | `/auth/me` | – | `200 { user, csrfToken }` or `401` |

Password policy: 10–128 characters with at least one letter and one digit. `user` is `{ id, name, email, preferences: { currency, locale, timeZone, dateStyle }, createdAt }`.

## Account (signed in)

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| PATCH | `/users/me` | `{ name }` | `{ user }` |
| PATCH | `/users/me/preferences` | any of `{ currency, locale, timeZone, dateStyle }` | `{ user }`; `409 CURRENCY_LOCKED` if transactions exist |
| POST | `/users/me/password` | `{ currentPassword, newPassword }` | `{ csrfToken }`; all sessions revoked, a new one issued |
| POST | `/users/me/sessions/revoke-others` | – | `{ revoked }` |
| DELETE | `/users/me` | `{ password }` | `204`; all data and sessions removed |

## Categories

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/categories?type=&includeArchived=true` | `{ items: CategoryDto[] }` |
| POST | `/categories` | `{ name, type, icon?, color? }` → `201 { category }`; `409 CATEGORY_EXISTS` (case-insensitive per type) |
| PATCH | `/categories/:id` | any of `{ name, icon, color, archived }` |
| DELETE | `/categories/:id` | `204`; `409 CATEGORY_IN_USE` when referenced by transactions or budgets |

## Transactions

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/transactions` | Query: `q` (merchant/note), `type`, `categoryId`, `paymentMethod`, `recurring`, `from`, `to`, `minAmount`, `maxAmount`, `sort` (`date`\|`amount`\|`merchant`\|`createdAt`), `order`, `page`, `pageSize` (≤100). Returns `{ items, page, pageSize, total, totalPages }` |
| GET | `/transactions/:id` | `{ transaction }` |
| POST | `/transactions` | `{ type, amount, categoryId, date, paymentMethod, merchant?, note?, recurring? }` → `201 { transaction }` |
| PATCH | `/transactions/:id` | any subset of the create fields |
| DELETE | `/transactions/:id` | `204` |

Category must belong to the caller, match `type`, and not be archived (an archived category already on the transaction may be kept). `paymentMethod`: `cash`, `debit_card`, `credit_card`, `bank_transfer`, `upi`, `wallet`, `cheque`, `other`.

## Budgets

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/budgets?month=YYYY-MM` | `{ month, currency, budgets: BudgetDto[], totals: { limitMinor, spentMinor, remainingMinor } }` |
| POST | `/budgets` | `{ categoryId, month, amount, warningThresholdPct? (50–100, default 80) }`; expense categories only; `409 BUDGET_EXISTS` |
| PATCH | `/budgets/:id` | `{ amount?, warningThresholdPct? }` |
| DELETE | `/budgets/:id` | `204` |
| POST | `/budgets/copy` | `{ fromMonth, toMonth }` → `{ copied, skipped }` |

`BudgetDto.status`: `on_track`, `warning` (spent ≥ threshold % of limit, including exactly at the limit), `over` (spent > limit). `usedBps` is spent as basis points of the limit.

## Dashboard and reports

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dashboard?from=&to=` | Totals (`incomeMinor`, `expenseMinor`, `netMinor`, `transactionCount`, `savingsRateBps` or null), 12-month `trend` ending at `to`’s month, `expenseByCategory` with `shareBps`, 6 most recent in range, `budgetAlerts` for `to`’s month |
| GET | `/reports/comparison?month=` | Current vs previous month totals, `change.incomeBps`/`expenseBps`/`netMinor`, per-category rows with `changeBps` (null when the previous value is 0) |
| GET | `/reports/trend?from=YYYY-MM&to=YYYY-MM` | ≤ 24 months; `series`, `totals`, `averageMonthlyExpenseMinor` |

Ranges are inclusive and limited to 1,096 days.

## Export

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/exports/transactions.csv?from=&to=&type=&categoryId=` | `text/csv` attachment, UTF-8 with BOM, CRLF. Columns: Date, Type, Category, Amount, Currency, Payment method, Merchant / payee, Note, Recurring. Max 10,000 rows (`422 EXPORT_TOO_LARGE`), max 1,096 days, 10 exports per 15 minutes per user. Header `X-Export-Row-Count`. |
