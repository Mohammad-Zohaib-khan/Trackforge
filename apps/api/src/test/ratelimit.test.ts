import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, registerUser, startHarness, type Harness } from './harness.js';

let h: Harness;

beforeAll(async () => {
  h = await startHarness({ LOGIN_FAILURES_PER_EMAIL_MAX: '2', AUTH_RATE_LIMIT_MAX: '6' });
});
afterAll(async () => {
  await h.stop();
});

describe('rate limiting', () => {
  it('limits repeated failed logins for one email', async () => {
    const user = await registerUser(h.app);
    const attempt = () =>
      request(h.app).post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email: user.email, password: 'wrong-password-9' });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('limits auth requests per client address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await request(h.app)
        .post('/api/v1/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: `someone${i}@example.test`, password: 'whatever-123' });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
