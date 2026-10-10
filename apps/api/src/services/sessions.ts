import mongoose from 'mongoose';
import type { Request } from 'express';
import { generateCsrfToken } from '../middleware/csrf.js';
import { SESSION_COLLECTION } from '../middleware/session.js';

/**
 * Issues a fresh session id for a user (prevents session fixation) and a new CSRF token.
 * Used after sign-in, registration and password changes.
 */
export function establishSession(req: Request, userId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr instanceof Error ? regenErr : new Error('Session regenerate failed'));
      const csrfToken = generateCsrfToken();
      req.session.userId = userId;
      req.session.issuedAt = Date.now();
      req.session.csrfToken = csrfToken;
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr instanceof Error ? saveErr : new Error('Session save failed'));
        resolve(csrfToken);
      });
    });
  });
}

/** Revokes every stored session for a user, optionally keeping one (the caller's). */
export async function revokeUserSessions(userId: string, keepSessionId?: string): Promise<number> {
  const filter: Record<string, unknown> = { 'session.userId': userId };
  if (keepSessionId) filter['_id'] = { $ne: keepSessionId };
  const result = await mongoose.connection.collection(SESSION_COLLECTION).deleteMany(filter);
  return result.deletedCount;
}
