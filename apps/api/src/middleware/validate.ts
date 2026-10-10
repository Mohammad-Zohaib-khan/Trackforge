import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { HttpError } from '../utils/httpError.js';

/** Parses with a schema; failures become 400 VALIDATION_ERROR via the error handler. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}

const MAX_DEPTH = 6;

function hasUnsafeKey(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((v) => hasUnsafeKey(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return true;
      }
      if (hasUnsafeKey(inner, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Rejects MongoDB operator keys ($gt, $where…), dotted paths and prototype keys anywhere
 * in the body or query before any handler runs. Schemas validate types afterwards, so an
 * operator object can never reach a query where a scalar is expected.
 */
export function rejectOperatorInjection(req: Request, _res: Response, next: NextFunction): void {
  const queryKeys = Object.keys(req.query);
  if (queryKeys.some((k) => k.includes('[') || k.startsWith('$')) || hasUnsafeKey(req.query) || hasUnsafeKey(req.body)) {
    next(new HttpError(400, 'INVALID_INPUT', 'Request contains disallowed keys'));
    return;
  }
  next();
}

/** Route params must be 24-char hex ids; anything else is reported as not found. */
export function idParam(req: Request, name = 'id'): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new HttpError(404, 'NOT_FOUND', 'Resource not found');
  }
  return value;
}
