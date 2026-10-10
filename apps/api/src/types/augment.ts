import type { Types } from 'mongoose';
import type { CurrencyCode } from '@trackforge/shared';

export interface AuthContext {
  userId: string;
  ownerId: Types.ObjectId;
  currency: CurrencyCode;
  timeZone: string;
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
    /** Epoch ms when the session was created at sign-in; enforces the absolute lifetime. */
    issuedAt: number;
    /** Synchronizer token required on state-changing requests. */
    csrfToken: string;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}
