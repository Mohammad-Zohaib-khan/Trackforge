# Security

TrackForge stores personal financial records, so it is built defensively. This document lists the controls that exist in code, how they are tested, and the risks that remain. It makes no compliance claims (no PCI DSS, SOC 2 or banking certification) and does not guarantee security.

## Threat model (summary)

Assets: account credentials, session identifiers, users’ transaction history.
Adversaries considered: other signed-in users (horizontal access), anonymous internet clients (credential stuffing, injection), malicious sites in the same browser (CSRF), people opening exported files (formula injection), operators reading logs.
Out of scope: compromised hosts or database, malicious browser extensions, physical access to an unlocked device.

## Controls

| Area | Implementation | Where |
| --- | --- | --- |
| Password storage | Argon2id (19 MiB, t=2, p=1). Hashes are `select: false` and never serialised. | `services/passwords.ts`, `models/user.ts` |
| Login responses | One generic message for unknown email and wrong password; a dummy verification equalises timing. | `modules/auth/routes.ts` |
| Sessions | Server-side sessions in MongoDB; the cookie holds only a signed opaque id. `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`. | `middleware/session.ts` |
| Expiry | Idle timeout (rolling cookie, default 120 min) and absolute lifetime (default 7 days) checked on every request. | `middleware/auth.ts` |
| Rotation & revocation | New session id on login, registration and password change (prevents fixation). Logout destroys the server record. Password change revokes all sessions; “sign out other sessions” revokes all but the current one. Account deletion revokes all. | `services/sessions.ts`, `modules/users/routes.ts` |
| Authorisation | `requireAuth` on every non-auth router; identity comes only from the session; every query is scoped by `ownerId`; cross-user ids return `404` identical to missing records. | `app.ts`, all `modules/*` |
| Mass assignment | Strict Zod schemas reject unknown keys; updates copy an explicit allowlist of fields; models use `strict: 'throw'`; `ownerId`, `type` of categories and budget month are immutable. | `packages/shared/src/schemas.ts`, routes |
| NoSQL injection | Body/query keys beginning with `$`, containing `.`, or `__proto__`/`constructor`/`prototype` are rejected; Express `simple` query parser (no nested objects); schemas require scalars; regex search input is escaped. | `middleware/validate.ts`, `utils/regex.ts` |
| CSRF | SameSite=Lax cookie, plus an Origin/Referer allowlist on every state-changing request, plus a per-session synchroniser token (`X-CSRF-Token`) compared in constant time. The token lives only in memory in the SPA. | `middleware/csrf.ts`, `apps/web/src/lib/api.ts` |
| XSS | React escaping; no `dangerouslySetInnerHTML`; strict CSP via Helmet (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`). No auth tokens in `localStorage`. | `app.ts` |
| CORS | Exact-match origin allowlist (`APP_ORIGINS`), credentials allowed only for those origins. Production requires HTTPS origins. | `app.ts`, `config/env.ts` |
| Headers | Helmet defaults + HSTS in production, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Powered-By` removed, `Cache-Control: no-store` on API responses. | `app.ts` |
| Rate limiting | Global API limit; auth limit per IP; failed-login limit per email; export limit per user. | `middleware/rateLimits.ts` |
| Request limits | JSON body 32 kB; page size ≤ 100; date ranges ≤ 1,096 days; trends ≤ 24 months; exports ≤ 10,000 rows. | shared schemas, routes |
| CSV export | Cells beginning with `= + - @`, tab or CR are prefixed with `'`; RFC 4180 quoting; UTF-8 BOM; filename sanitised; owner-scoped. | `utils/csv.ts`, `modules/exports/routes.ts` |
| Errors | Single safe JSON shape; stack traces and internals never returned; 5xx logged server-side only. | `middleware/errorHandler.ts` |
| Logging | Pino with redaction of cookies, auth headers, CSRF tokens and password fields; request logs omit query strings and bodies. | `config/logger.ts`, `app.ts` |
| Configuration | Env validated at startup; production rejects placeholder secrets and non-HTTPS origins; values are never echoed in errors. | `config/env.ts` |
| Dependencies | Lockfile committed; `npm audit` reported 0 vulnerabilities at build time (see PROJECT_PROGRESS.md for date). CI runs `npm audit --omit=dev --audit-level=high`. | `.github/workflows/ci.yml` |

## Security tests

`apps/api/src/test/isolation.test.ts` proves a second user cannot read, update, delete, list, aggregate or export another user’s transactions, categories or budgets, cannot attach another user’s category, and cannot reuse another user’s CSRF token. `auth.test.ts` covers cookie attributes, Argon2id storage, generic login errors, session rotation, logout revocation, absolute expiry, password-change revocation, CSRF origin and token checks, operator injection, malformed JSON, oversized bodies and headers. `ratelimit.test.ts` covers login throttling. `export.test.ts` covers formula injection, quoting, range validation and the row limit.

## Residual risks and operator responsibilities

- **Rate limit store is in memory.** Correct for a single API instance. Running several instances needs a shared store (e.g. Redis via `rate-limit-redis`).
- **Registration reveals whether an email is registered** (409). Mitigated by the per-IP auth limit; there is no email verification or password reset flow, so no reset-token risk exists, but users who forget passwords cannot recover accounts.
- **No multi-factor authentication.**
- **Session secret rotation** invalidates all sessions; plan rotations accordingly.
- **Database security is the operator’s job**: least-privilege user (`readWrite` on one database), network allowlisting, TLS (default on Atlas), encrypted backups and tested restores.
- **TLS termination**: run behind HTTPS and set `TRUST_PROXY` to the number of proxies so `Secure` cookies and client IPs are correct.
- **Data at rest** is not encrypted at the application level; rely on the database provider’s encryption.

## Reporting

Report vulnerabilities privately to the repository owner rather than in public issues.
