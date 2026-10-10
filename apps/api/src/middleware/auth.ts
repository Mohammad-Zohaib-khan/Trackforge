import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/user.js';
import { HttpError, unauthorized } from '../utils/httpError.js';
import type { AuthContext } from '../types/augment.js';

/**
 * Resolves the signed-in user from the server-side session only. Client-supplied
 * owner ids are never consulted. Enforces the absolute session lifetime and that
 * the account still exists and is active.
 */
export function requireAuth(absoluteMs: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId, issuedAt } = req.session ?? {};
    if (!userId || typeof issuedAt !== 'number' || !Types.ObjectId.isValid(userId)) {
      return next(unauthorized());
    }
    if (sessionExpired(issuedAt, absoluteMs)) {
      await destroySession(req, res);
      return next(new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.'));
    }
    const user = await User.findById(userId).select({ status: 1, preferences: 1 }).lean();
    if (!user || user.status !== 'active') {
      await destroySession(req, res);
      return next(unauthorized());
    }
    req.auth = {
      userId,
      ownerId: new Types.ObjectId(userId),
      currency: user.preferences.currency,
      timeZone: user.preferences.timeZone,
    };
    next();
  };
}

export function sessionExpired(issuedAt: number, absoluteMs: number): boolean {
  return Date.now() - issuedAt > absoluteMs;
}

/** Narrowing accessor for handlers mounted behind requireAuth. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function destroySession(req: Request, res: Response): Promise<void> {
  return new Promise((resolve) => {
    const cookieName = (req.app.get('sessionCookieName') as string | undefined) ?? 'tf.sid';
    if (!req.session) {
      res.clearCookie(cookieName, { path: '/' });
      resolve();
      return;
    }
    req.session.destroy(() => {
      res.clearCookie(cookieName, { path: '/' });
      resolve();
    });
  });
}
