import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../utils/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

function originOf(req: Request): string | null {
  const origin = req.get('origin');
  if (origin && origin !== 'null') return origin;
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function tokensMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * CSRF defence in depth for cookie-based sessions:
 *  1. SameSite=Lax session cookie (set in session middleware).
 *  2. Every state-changing request must carry an Origin/Referer from an allowed origin.
 *  3. Requests made with a signed-in session must echo the per-session synchronizer
 *     token in the X-CSRF-Token header.
 */
export function csrfProtection(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = originOf(req);
    if (!origin || !allowed.has(origin)) {
      return next(new HttpError(403, 'CSRF_ORIGIN_REJECTED', 'Request origin is not allowed'));
    }

    const sessionToken = req.session?.csrfToken;
    if (req.session?.userId) {
      const header = req.get('x-csrf-token');
      if (!sessionToken || !header || !tokensMatch(sessionToken, header)) {
        return next(new HttpError(403, 'CSRF_TOKEN_INVALID', 'Your session token is missing or out of date. Reload the page and try again.'));
      }
    }
    return next();
  };
}
