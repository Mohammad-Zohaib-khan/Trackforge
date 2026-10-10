import { Router } from 'express';
import {
  changePasswordSchema,
  deleteAccountSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from '@trackforge/shared';
import { User, toSafeUser } from '../../models/user.js';
import { Transaction } from '../../models/transaction.js';
import { Category } from '../../models/category.js';
import { Budget } from '../../models/budget.js';
import { parse } from '../../middleware/validate.js';
import { authOf, destroySession } from '../../middleware/auth.js';
import { hashPassword, verifyPassword } from '../../services/passwords.js';
import { establishSession, revokeUserSessions } from '../../services/sessions.js';
import { HttpError, conflict, unauthorized } from '../../utils/httpError.js';

export function createUsersRouter(): Router {
  const router = Router();

  router.patch('/me', async (req, res) => {
    const { ownerId } = authOf(req);
    const input = parse(updateProfileSchema, req.body);
    const user = await User.findById(ownerId);
    if (!user) throw unauthorized();
    user.name = input.name;
    await user.save();
    res.json({ user: toSafeUser(user) });
  });

  router.patch('/me/preferences', async (req, res) => {
    const auth = authOf(req);
    const input = parse(updatePreferencesSchema, req.body);

    if (input.currency && input.currency !== auth.currency) {
      const hasRecords = await Transaction.exists({ ownerId: auth.ownerId });
      if (hasRecords) {
        throw conflict(
          'CURRENCY_LOCKED',
          'Currency can only change before you record transactions, so totals never mix currencies.',
        );
      }
    }

    const user = await User.findById(auth.ownerId);
    if (!user) throw unauthorized();
    if (input.currency) user.preferences.currency = input.currency;
    if (input.locale) user.preferences.locale = input.locale;
    if (input.timeZone) user.preferences.timeZone = input.timeZone;
    if (input.dateStyle) user.preferences.dateStyle = input.dateStyle;
    await user.save();
    res.json({ user: toSafeUser(user) });
  });

  router.post('/me/password', async (req, res) => {
    const { ownerId, userId } = authOf(req);
    const input = parse(changePasswordSchema, req.body);
    const user = await User.findById(ownerId).select('+passwordHash');
    if (!user) throw unauthorized();
    const ok = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!ok) {
      throw new HttpError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect', {
        currentPassword: 'Current password is incorrect',
      });
    }
    user.passwordHash = await hashPassword(input.newPassword);
    await user.save();

    // Privilege-relevant change: revoke every session, then issue a fresh one for this device.
    await revokeUserSessions(userId);
    const csrfToken = await establishSession(req, userId);
    res.json({ csrfToken });
  });

  router.post('/me/sessions/revoke-others', async (req, res) => {
    const { userId } = authOf(req);
    const revoked = await revokeUserSessions(userId, req.sessionID);
    res.json({ revoked });
  });

  router.delete('/me', async (req, res) => {
    const { ownerId, userId } = authOf(req);
    const input = parse(deleteAccountSchema, req.body);
    const user = await User.findById(ownerId).select('+passwordHash');
    if (!user) throw unauthorized();
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new HttpError(400, 'INVALID_PASSWORD', 'Password is incorrect', { password: 'Password is incorrect' });
    }
    await Promise.all([
      Transaction.deleteMany({ ownerId }),
      Budget.deleteMany({ ownerId }),
      Category.deleteMany({ ownerId }),
    ]);
    await User.deleteOne({ _id: ownerId });
    await revokeUserSessions(userId);
    await destroySession(req, res);
    res.status(204).end();
  });

  return router;
}
