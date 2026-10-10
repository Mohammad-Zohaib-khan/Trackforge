# Database models and indexes

MongoDB via Mongoose 9. All models use `strict: 'throw'` and timestamps. Indexes are created explicitly at startup (`createIndexes`), with `autoIndex` off.

## users

| Field | Type | Notes |
| --- | --- | --- |
| name | string ≤ 80 | |
| email | string ≤ 254 | lower-cased, trimmed |
| passwordHash | string | Argon2id; `select: false` |
| status | `active` \| `disabled` | disabled accounts cannot sign in |
| preferences | `{ currency, locale, timeZone, dateStyle }` | |

Indexes: `{ email: 1 }` unique.

## categories

| Field | Type | Notes |
| --- | --- | --- |
| ownerId | ObjectId → users | immutable |
| name / nameKey | string ≤ 40 / lower-case copy | |
| type | `income` \| `expense` | immutable |
| icon | enum of 25 icon ids | |
| color | `#RRGGBB` or null | |
| archived | boolean | hidden from new entries, kept in history |
| isDefault | boolean | copied from the starter set at registration |

Indexes: `{ ownerId: 1, type: 1, nameKey: 1 }` unique.

## transactions

| Field | Type | Notes |
| --- | --- | --- |
| ownerId | ObjectId | immutable |
| type | `income` \| `expense` | |
| amountMinor | safe integer ≥ 1 | sign comes from `type` |
| currency | ISO code | copied from the account currency |
| categoryId | ObjectId → categories | must be the owner’s and match `type` |
| date | `YYYY-MM-DD` | calendar date in the user’s calendar |
| month | `YYYY-MM` | derived in `pre('validate')` |
| paymentMethod | enum | |
| merchant / merchantKey | string ≤ 80 / lower-case copy for sorting | |
| note | string ≤ 500 | |
| recurring | boolean | informational marker |

Indexes: `{ ownerId: 1, date: -1, _id: -1 }` (listing, ranges), `{ ownerId: 1, month: 1, type: 1 }` (totals, trends), `{ ownerId: 1, categoryId: 1, month: 1 }` (budgets, category filters, delete checks).

## budgets

| Field | Type | Notes |
| --- | --- | --- |
| ownerId, categoryId, month | ObjectId, ObjectId, `YYYY-MM` | all immutable |
| amountMinor | safe integer ≥ 1 | |
| warningThresholdPct | 50–100 | |

Indexes: `{ ownerId: 1, categoryId: 1, month: 1 }` unique (one budget per category per month), `{ ownerId: 1, month: 1 }`.

## sessions (connect-mongo)

Documents `{ _id: sessionId, expires, session: { cookie, userId, issuedAt, csrfToken } }` stored unstringified so a user’s sessions can be revoked by query. With `SESSION_STORE_AUTOREMOVE=native` connect-mongo creates a TTL index on `expires`.

## Money and precision

Integers in minor units are summed with `$sum`; with the 1-billion cap per entry, totals remain exact well past any personal ledger. Percentages are returned as integer basis points and rounded once.

## Backups

Use Atlas continuous backups or scheduled `mongodump` to encrypted storage, and test restores. Sessions do not need backing up.
