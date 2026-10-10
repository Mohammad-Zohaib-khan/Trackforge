import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .refine((v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'), 'MONGODB_URI must be a MongoDB connection string'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9._-]+$/).default('tf.sid'),
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(120),
    SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    SESSION_STORE_AUTOREMOVE: z.enum(['native', 'interval', 'disabled']).default('native'),
    APP_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1)),
    MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(200).default(20),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    SERVE_WEB_DIST: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
    LOGIN_FAILURES_PER_EMAIL_MAX: z.coerce.number().int().min(1).default(5),
    EXPORT_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
    REQUIRE_HTTPS: booleanString.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (/change-me|example|placeholder/i.test(env.SESSION_SECRET)) {
        ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Replace the placeholder SESSION_SECRET in production' });
      }
      if (env.APP_ORIGINS.some((o) => o.startsWith('http://') && !o.includes('localhost'))) {
        ctx.addIssue({ code: 'custom', path: ['APP_ORIGINS'], message: 'Production origins must use HTTPS' });
      }
    }
  });

export type Env = z.output<typeof envSchema>;

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  mongoUri: string;
  mongoMaxPoolSize: number;
  session: {
    secret: string;
    cookieName: string;
    idleMs: number;
    absoluteMs: number;
    storeAutoRemove: Env['SESSION_STORE_AUTOREMOVE'];
    secureCookie: boolean;
  };
  appOrigins: string[];
  trustProxy: number;
  serveWebDist: string | undefined;
  logLevel: Env['LOG_LEVEL'];
  rateLimits: {
    auth: number;
    loginFailuresPerEmail: number;
    export: number;
    api: number;
  };
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  • ${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}\nSee .env.example for the required variables.`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';
  return {
    env: env.NODE_ENV,
    isProduction,
    port: env.PORT,
    mongoUri: env.MONGODB_URI,
    mongoMaxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    session: {
      secret: env.SESSION_SECRET,
      cookieName: env.SESSION_COOKIE_NAME,
      idleMs: env.SESSION_IDLE_MINUTES * 60_000,
      absoluteMs: env.SESSION_ABSOLUTE_HOURS * 3_600_000,
      storeAutoRemove: env.SESSION_STORE_AUTOREMOVE,
      secureCookie: env.REQUIRE_HTTPS ?? isProduction,
    },
    appOrigins: env.APP_ORIGINS,
    trustProxy: env.TRUST_PROXY,
    serveWebDist: env.SERVE_WEB_DIST,
    logLevel: env.LOG_LEVEL,
    rateLimits: {
      auth: env.AUTH_RATE_LIMIT_MAX,
      loginFailuresPerEmail: env.LOGIN_FAILURES_PER_EMAIL_MAX,
      export: env.EXPORT_RATE_LIMIT_MAX,
      api: env.API_RATE_LIMIT_MAX,
    },
  };
}
