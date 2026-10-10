import { Router } from 'express';
import { loginSchema, registerSchema } from '@trackforge/shared';
import { User, toSafeUser } from '../../models/user.js';
import { parse } from '../../middleware/validate.js';
import { destroySession, requireAuth, sessionExpired } from '../../middleware/auth.js';
import { burnVerification, hashPassword, verifyPassword } from '../../services/passwords.js';
import { createStarterCategories } from '../../services/defaultCategories.js';
import { establishSession } from '../../services/sessions.js';
import { generateCsrfToken } from '../../middleware/csrf.js';
import { HttpError, conflict } from '../../utils/httpError.js';
import type { RateLimiters } from '../../middleware/rateLimits.js';
import { Category } from '../../models/category.js';

const INVALID_CREDENTIALS = new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

export function createAuthRouter(limiters: RateLimiters, absoluteMs: number): Router {
  const router = Router();

  router.post('/register', limiters.auth, async (req, res) => {
    const input = parse(registerSchema, req.body);
    const existing = await User.exists({ email: input.email });
    if (existing) throw conflict('EMAIL_IN_USE', 'An account already uses this email. Sign in instead.');

    const passwordHash = await hashPassword(input.password);
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      preferences: { currency: input.currency, timeZone: input.timeZone ?? 'UTC' },
    });
    try {
      await createStarterCategories(user._id);
    } catch (err) {
      await Promise.all([User.deleteOne({ _id: user._id }), Category.deleteMany({ ownerId: user._id })]);
      throw err;
    }
    const csrfToken = await establishSession(req, user._id.toString());
    res.status(201).json({ user: toSafeUser(user), csrfToken });
  });

  router.post('/login', limiters.auth, limiters.loginPerEmail, async (req, res) => {
    const input = parse(loginSchema, req.body);
    const user = await User.findOne({ email: input.email }).select('+passwordHash');
    if (!user) {
      await burnVerification(input.password);
      throw INVALID_CREDENTIALS;
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok || user.status !== 'active') throw INVALID_CREDENTIALS;

    const csrfToken = await establishSession(req, user._id.toString());
    res.json({ user: toSafeUser(user), csrfToken });
  });

  router.post('/logout', async (req, res) => {
    await destroySession(req, res);
    res.status(204).end();
  });

  /**
   * Session probe for page loads: always 200, so signed-out visitors do not see
   * an error. Returns { user: null } unless a valid, unexpired session exists.
   */
  router.get('/session', async (req, res) => {
    const { userId, issuedAt } = req.session ?? {};
    if (!userId || typeof issuedAt !== 'number') {
      res.json({ user: null });
      return;
    }
    const user = sessionExpired(issuedAt, absoluteMs) ? null : await User.findById(userId);
    if (!user || user.status !== 'active') {
      await destroySession(req, res);
      res.json({ user: null });
      return;
    }
    if (!req.session.csrfToken) req.session.csrfToken = generateCsrfToken();
    res.json({ user: toSafeUser(user), csrfToken: req.session.csrfToken });
  });

  router.get('/me', requireAuth(absoluteMs), async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue');
    if (!req.session.csrfToken) req.session.csrfToken = generateCsrfToken();
    res.json({ user: toSafeUser(user), csrfToken: req.session.csrfToken });
  });

  return router;
}
