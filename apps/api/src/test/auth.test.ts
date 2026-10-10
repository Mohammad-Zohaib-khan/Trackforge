import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, mutate, registerUser, startHarness, type Harness } from './harness.js';
import { User } from '../models/user.js';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.stop();
});

function sessionCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('tf.sid='));
}

describe('registration', () => {
  it('creates an account, starter categories and an HttpOnly SameSite session cookie', async () => {
    const agent = request.agent(h.app);
    const res = await agent
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .send({ name: 'Asha', email: 'Asha@Example.test', password: 'long-enough-1', currency: 'INR', timeZone: 'Asia/Kolkata' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha', email: 'asha@example.test', preferences: { currency: 'INR', timeZone: 'Asia/Kolkata' } });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const stored = await User.findOne({ email: 'asha@example.test' }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);

    const cats = await agent.get('/api/v1/categories');
    expect(cats.status).toBe(200);
    expect(cats.body.items.length).toBeGreaterThan(10);
  });

  it('rejects duplicate emails, weak passwords and unknown fields', async () => {
    await registerUser(h.app, { email: 'dupe@example.test' });
    const dupe = await request(h.app).post('/api/v1/auth/register').set('Origin', ORIGIN).send({ name: 'X', email: 'DUPE@example.test', password: 'long-enough-1' });
    expect(dupe.status).toBe(409);

    const weak = await request(h.app).post('/api/v1/auth/register').set('Origin', ORIGIN).send({ name: 'X', email: 'w@example.test', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toBeTruthy();

    const extra = await request(h.app)
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .send({ name: 'X', email: 'x@example.test', password: 'long-enough-1', status: 'disabled', role: 'admin' });
    expect(extra.status).toBe(400);
  });
});

describe('login and sessions', () => {
  it('uses one generic message for unknown email and wrong password', async () => {
    const user = await registerUser(h.app);
    const wrong = await request(h.app).post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email: user.email, password: 'wrong-password-9' });
    const unknown = await request(h.app).post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email: 'nobody@example.test', password: 'wrong-password-9' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('rotates the session id on login (no session fixation)', async () => {
    const user = await registerUser(h.app);
    const before = await user.agent.get('/api/v1/auth/me');
    expect(before.status).toBe(200);
    const login = await mutate(user, 'post', '/api/v1/auth/login').send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);
    expect(login.body.csrfToken).not.toBe(user.csrf);
    const sessions = await mongoose.connection.collection('sessions').countDocuments({ 'session.userId': user.id });
    // Old registration session was replaced by the new login session.
    expect(sessions).toBe(1);
  });

  it('logout destroys the server-side session so the old cookie stops working', async () => {
    const user = await registerUser(h.app);
    const me = await user.agent.get('/api/v1/auth/me');
    const cookieHeader = (me.request as unknown as { cookies?: string }).cookies;
    const logout = await mutate(user, 'post', '/api/v1/auth/logout');
    expect(logout.status).toBe(204);
    expect(await mongoose.connection.collection('sessions').countDocuments({ 'session.userId': user.id })).toBe(0);
    const after = await user.agent.get('/api/v1/auth/me');
    expect(after.status).toBe(401);
    if (cookieHeader) {
      const replay = await request(h.app).get('/api/v1/auth/me').set('Cookie', cookieHeader);
      expect(replay.status).toBe(401);
    }
  });

  it('enforces the absolute session lifetime', async () => {
    const user = await registerUser(h.app);
    await mongoose.connection
      .collection('sessions')
      .updateOne({ 'session.userId': user.id }, { $set: { 'session.issuedAt': Date.now() - h.config.session.absoluteMs - 1000 } });
    const res = await user.agent.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('password change revokes other sessions and keeps the current one', async () => {
    const user = await registerUser(h.app);
    const other = request.agent(h.app);
    const otherLogin = await other.post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email: user.email, password: user.password });
    expect(otherLogin.status).toBe(200);

    const change = await mutate(user, 'post', '/api/v1/users/me/password').send({ currentPassword: user.password, newPassword: 'brand-new-pass-7' });
    expect(change.status).toBe(200);
    expect(typeof change.body.csrfToken).toBe('string');

    expect((await other.get('/api/v1/auth/me')).status).toBe(401);
    expect((await user.agent.get('/api/v1/auth/me')).status).toBe(200);

    const oldPw = await request(h.app).post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email: user.email, password: user.password });
    expect(oldPw.status).toBe(401);
  });

  it('rejects password change with the wrong current password', async () => {
    const user = await registerUser(h.app);
    const res = await mutate(user, 'post', '/api/v1/users/me/password').send({ currentPassword: 'not-my-password-1', newPassword: 'brand-new-pass-7' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.currentPassword).toBeTruthy();
  });

  it('requires authentication on protected endpoints', async () => {
    for (const path of ['/api/v1/transactions', '/api/v1/categories', '/api/v1/budgets?month=2026-01', '/api/v1/dashboard?from=2026-01-01&to=2026-01-31', '/api/v1/reports/comparison?month=2026-01', '/api/v1/exports/transactions.csv?from=2026-01-01&to=2026-01-31']) {
      const res = await request(h.app).get(path);
      expect(res.status, path).toBe(401);
    }
  });
});

describe('CSRF protection', () => {
  it('blocks state-changing requests without the session token', async () => {
    const user = await registerUser(h.app);
    const res = await user.agent.post('/api/v1/categories').set('Origin', ORIGIN).send({ name: 'Pets', type: 'expense' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('blocks requests from other origins or with no origin', async () => {
    const user = await registerUser(h.app);
    const foreign = await user.agent.post('/api/v1/categories').set('Origin', 'https://evil.example').set('X-CSRF-Token', user.csrf).send({ name: 'Pets', type: 'expense' });
    expect(foreign.status).toBe(403);
    const none = await user.agent.post('/api/v1/categories').set('X-CSRF-Token', user.csrf).send({ name: 'Pets', type: 'expense' });
    expect(none.status).toBe(403);
    const ok = await mutate(user, 'post', '/api/v1/categories').send({ name: 'Pets', type: 'expense' });
    expect(ok.status).toBe(201);
  });
});

describe('profile and preferences', () => {
  it('updates name and preferences, and locks currency once transactions exist', async () => {
    const user = await registerUser(h.app);
    const name = await mutate(user, 'patch', '/api/v1/users/me').send({ name: 'Renamed' });
    expect(name.status, JSON.stringify(name.body)).toBe(200);
    expect(name.body.user.name).toBe('Renamed');
    const prefs = await mutate(user, 'patch', '/api/v1/users/me/preferences').send({ currency: 'EUR', locale: 'de-DE', dateStyle: 'iso' });
    expect(prefs.status).toBe(200);
    expect(prefs.body.user.preferences).toMatchObject({ currency: 'EUR', locale: 'de-DE', dateStyle: 'iso' });

    const cats = await user.agent.get('/api/v1/categories?type=expense');
    await mutate(user, 'post', '/api/v1/transactions').send({ type: 'expense', amount: '5', categoryId: cats.body.items[0].id, date: '2026-01-02', paymentMethod: 'cash' });
    const locked = await mutate(user, 'patch', '/api/v1/users/me/preferences').send({ currency: 'USD' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('CURRENCY_LOCKED');

    const badTz = await mutate(user, 'patch', '/api/v1/users/me/preferences').send({ timeZone: 'Mars/Olympus' });
    expect(badTz.status).toBe(400);
  });

  it('deletes the account and every owned record after password confirmation', async () => {
    const user = await registerUser(h.app);
    const cats = await user.agent.get('/api/v1/categories?type=expense');
    await mutate(user, 'post', '/api/v1/transactions').send({ type: 'expense', amount: '5', categoryId: cats.body.items[0].id, date: '2026-01-02', paymentMethod: 'cash' });
    const wrong = await mutate(user, 'delete', '/api/v1/users/me').send({ password: 'nope-nope-1' });
    expect(wrong.status).toBe(400);
    const res = await mutate(user, 'delete', '/api/v1/users/me').send({ password: user.password });
    expect(res.status).toBe(204);
    const ownerId = new mongoose.Types.ObjectId(user.id);
    expect(await mongoose.connection.collection('transactions').countDocuments({ ownerId })).toBe(0);
    expect(await mongoose.connection.collection('categories').countDocuments({ ownerId })).toBe(0);
    expect(await User.exists({ _id: ownerId })).toBeNull();
  });
});

describe('input hardening', () => {
  it('rejects operator injection in body and query', async () => {
    const user = await registerUser(h.app);
    const login = await request(h.app).post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email: { $ne: null }, password: { $ne: null } });
    expect(login.status).toBe(400);
    const q = await user.agent.get('/api/v1/transactions?type[$ne]=income');
    expect(q.status).toBe(400);
    const nested = await mutate(user, 'post', '/api/v1/categories').send({ name: 'x', type: 'expense', color: { $gt: '' } });
    expect(nested.status).toBe(400);
  });

  it('returns safe errors for malformed JSON and oversized bodies', async () => {
    const user = await registerUser(h.app);
    const bad = await user.agent.post('/api/v1/categories').set('Origin', ORIGIN).set('X-CSRF-Token', user.csrf).set('Content-Type', 'application/json').send('{"name":');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
    const big = await mutate(user, 'post', '/api/v1/categories').send({ name: 'x'.repeat(40_000), type: 'expense' });
    expect(big.status).toBe(413);
    expect(JSON.stringify(big.body)).not.toMatch(/at\s+\w+\s+\(/);
  });

  it('sets security headers', async () => {
    const res = await request(h.app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('session probe', () => {
  it('returns 200 with a null user when signed out, and the user when signed in', async () => {
    const anon = await request(h.app).get('/api/v1/auth/session');
    expect(anon.status).toBe(200);
    expect(anon.body).toEqual({ user: null });
    const user = await registerUser(h.app);
    const res = await user.agent.get('/api/v1/auth/session');
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.csrfToken).toBe(user.csrf);
  });
});
