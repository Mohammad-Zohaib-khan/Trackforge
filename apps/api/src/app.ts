import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { MongoClient } from 'mongodb';
import type { AppConfig } from './config/env.js';
import { createSessionMiddleware } from './middleware/session.js';
import { csrfProtection } from './middleware/csrf.js';
import { requireAuth } from './middleware/auth.js';
import { rejectOperatorInjection } from './middleware/validate.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimiters } from './middleware/rateLimits.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createUsersRouter } from './modules/users/routes.js';
import { createCategoriesRouter } from './modules/categories/routes.js';
import { createTransactionsRouter } from './modules/transactions/routes.js';
import { createBudgetsRouter } from './modules/budgets/routes.js';
import { createDashboardRouter } from './modules/dashboard/routes.js';
import { createReportsRouter } from './modules/reports/routes.js';
import { createExportsRouter } from './modules/exports/routes.js';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  mongoClient: MongoClient;
}

export function createApp({ config, logger, mongoClient }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('query parser', 'simple');
  app.set('sessionCookieName', config.session.cookieName);

  app.use(
    pinoHttp({
      logger,
      // Log method, path and status only: no query strings (may hold search text), bodies or cookies.
      serializers: {
        req: (req: { method?: string; url?: string; id?: unknown }) => ({
          id: req.id,
          method: req.method,
          path: typeof req.url === 'string' ? req.url.split('?')[0] : undefined,
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.appOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      exposedHeaders: ['Content-Disposition', 'X-Export-Row-Count'],
      maxAge: 600,
    }),
  );

  const limiters = createRateLimiters(config);
  const api = Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  api.use(limiters.api);
  api.use(express.json({ limit: '32kb', strict: true }));
  api.use(rejectOperatorInjection);
  api.use(createSessionMiddleware(config, mongoClient));
  api.use(csrfProtection(config.appOrigins));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const authed = requireAuth(config.session.absoluteMs);
  api.use('/auth', createAuthRouter(limiters, config.session.absoluteMs));
  api.use('/users', authed, createUsersRouter());
  api.use('/categories', authed, createCategoriesRouter());
  api.use('/transactions', authed, createTransactionsRouter());
  api.use('/budgets', authed, createBudgetsRouter());
  api.use('/dashboard', authed, createDashboardRouter());
  api.use('/reports', authed, createReportsRouter());
  api.use('/exports', authed, limiters.exports, createExportsRouter());
  api.use(notFoundHandler);

  app.use('/api/v1', api);

  if (config.serveWebDist) {
    // Relative paths resolve against apps/api (not the process cwd, which differs per host).
    const dist = path.resolve(API_ROOT, config.serveWebDist);
    app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
