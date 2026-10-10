import { pino, type Logger } from 'pino';

/** Paths that must never reach logs: credentials, session identifiers and tokens. */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'csrfToken',
  'sessionId',
  '*.password',
  '*.passwordHash',
  '*.csrfToken',
];

export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'trackforge-api' },
  });
}
