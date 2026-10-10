import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { inject } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { loadConfig, type AppConfig } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { connectDatabase } from '../db.js';

export const ORIGIN = 'http://localhost:5173';

export interface Harness {
  app: Express;
  config: AppConfig;
  stop: () => Promise<void>;
}

function withDatabase(uri: string, dbName: string): string {
  const url = new URL(uri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** Starts the real app against an isolated, throwaway database. */
export async function startHarness(overrides: Record<string, string> = {}): Promise<Harness> {
  const dbName = `tf_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const config = loadConfig({
    NODE_ENV: 'test',
    MONGODB_URI: withDatabase(inject('mongoUri'), dbName),
    SESSION_SECRET: 'test-only-secret-value-that-is-long-enough-123',
    APP_ORIGINS: ORIGIN,
    LOG_LEVEL: 'silent',
    SESSION_STORE_AUTOREMOVE: process.env['TEST_SESSION_AUTOREMOVE'] ?? 'native',
    AUTH_RATE_LIMIT_MAX: '1000',
    LOGIN_FAILURES_PER_EMAIL_MAX: '1000',
    EXPORT_RATE_LIMIT_MAX: '1000',
    API_RATE_LIMIT_MAX: '100000',
    ...overrides,
  });
  const mongoClient = await connectDatabase(config.mongoUri);
  const app = createApp({ config, logger: createLogger(process.env['TEST_LOG_LEVEL'] ?? 'silent'), mongoClient });
  return {
    app,
    config,
    stop: async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}

export type Agent = ReturnType<typeof request.agent>;

export interface TestUser {
  agent: Agent;
  csrf: string;
  id: string;
  email: string;
  password: string;
}

let counter = 0;

export async function registerUser(app: Express, overrides: Partial<{ name: string; email: string; password: string; currency: string }> = {}): Promise<TestUser> {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${randomUUID().slice(0, 6)}@example.test`;
  const password = overrides.password ?? 'correct-horse-42';
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/register')
    .set('Origin', ORIGIN)
    .send({ name: overrides.name ?? `User ${counter}`, email, password, currency: overrides.currency ?? 'USD' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: res.body.csrfToken as string, id: res.body.user.id as string, email, password };
}

type Method = 'post' | 'patch' | 'delete';

/** Sends a state-changing request with the Origin and CSRF headers a real browser client would send. */
export function mutate(user: Pick<TestUser, 'agent' | 'csrf'>, method: Method, url: string) {
  return user.agent[method](url).set('Origin', ORIGIN).set('X-CSRF-Token', user.csrf);
}

export async function categoryId(user: TestUser, name: string): Promise<string> {
  const res = await user.agent.get('/api/v1/categories');
  const found = (res.body.items as Array<{ id: string; name: string }>).find((c) => c.name === name);
  if (!found) throw new Error(`category ${name} not found`);
  return found.id;
}

export async function addTransaction(
  user: TestUser,
  input: { type?: 'income' | 'expense'; amount: string; category: string; date: string; merchant?: string; note?: string; paymentMethod?: string },
): Promise<{ id: string }> {
  const resolvedCategory = await categoryId(user, input.category);
  const res = await mutate(user, 'post', '/api/v1/transactions').send({
    type: input.type ?? 'expense',
    amount: input.amount,
    categoryId: resolvedCategory,
    date: input.date,
    paymentMethod: input.paymentMethod ?? 'debit_card',
    merchant: input.merchant,
    note: input.note,
  });
  if (res.status !== 201) throw new Error(`add tx failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.transaction.id as string };
}
