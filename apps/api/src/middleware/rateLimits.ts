import { rateLimit, ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';
import type { AppConfig } from '../config/env.js';

const WINDOW_MS = 15 * 60_000;

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

export interface RateLimiters {
  api: RateLimitRequestHandler;
  auth: RateLimitRequestHandler;
  loginPerEmail: RateLimitRequestHandler;
  exports: RateLimitRequestHandler;
}

/**
 * In-memory limiters suit a single API instance. Run several instances behind a
 * load balancer only with a shared store (see SECURITY.md).
 */
export function createRateLimiters(config: AppConfig): RateLimiters {
  return {
    api: rateLimit({
      windowMs: WINDOW_MS,
      limit: config.rateLimits.api,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: ipKey,
      message: message('Too many requests. Slow down and try again in a few minutes.'),
    }),
    auth: rateLimit({
      windowMs: WINDOW_MS,
      limit: config.rateLimits.auth,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: ipKey,
      message: message('Too many sign-in attempts. Try again in 15 minutes.'),
    }),
    loginPerEmail: rateLimit({
      windowMs: WINDOW_MS,
      limit: config.rateLimits.loginFailuresPerEmail,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => {
        const raw: unknown = (req.body as { email?: unknown } | undefined)?.email;
        return typeof raw === 'string' ? `email:${raw.trim().toLowerCase().slice(0, 254)}` : `ip:${ipKey(req)}`;
      },
      message: message('Too many failed attempts for this account. Try again in 15 minutes.'),
    }),
    exports: rateLimit({
      windowMs: WINDOW_MS,
      limit: config.rateLimits.export,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (req) => (req.auth ? `user:${req.auth.userId}` : `ip:${ipKey(req)}`),
      message: message('Export limit reached. Try again in 15 minutes.'),
    }),
  };
}
