import session from 'express-session';
import MongoStore from 'connect-mongo';
import type { MongoClient } from 'mongodb';
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env.js';

export const SESSION_COLLECTION = 'sessions';

/**
 * Server-side sessions stored in MongoDB. The browser only holds an opaque,
 * signed session id in an HttpOnly cookie. `stringify: false` stores session
 * data as a document so other sessions of a user can be revoked by query.
 */
export function createSessionMiddleware(config: AppConfig, client: MongoClient): RequestHandler {
  const store = MongoStore.create({
    client,
    collectionName: SESSION_COLLECTION,
    stringify: false,
    ttl: Math.ceil(config.session.absoluteMs / 1000),
    autoRemove: config.session.storeAutoRemove,
    touchAfter: 60,
  });

  return session({
    name: config.session.cookieName,
    secret: config.session.secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: config.trustProxy > 0,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.session.secureCookie,
      maxAge: config.session.idleMs,
      path: '/',
    },
  });
}
