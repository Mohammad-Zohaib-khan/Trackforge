import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Logger } from 'pino';
import { HttpError } from '../utils/httpError.js';
import type { ApiErrorBody } from '@trackforge/shared';

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

function bodyParserType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const t = (err as { type: unknown }).type;
    return typeof t === 'string' ? t : undefined;
  }
  return undefined;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } };
  res.status(404).json(body);
};

/** Converts every error into a safe JSON shape. Stack traces and internals never leave the server. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    let status = 500;
    let body: ApiErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Try again shortly.' } };

    if (err instanceof HttpError) {
      status = err.status;
      body = { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } };
    } else if (err instanceof ZodError) {
      status = 400;
      body = { error: { code: 'VALIDATION_ERROR', message: 'Some fields need attention', fields: zodFields(err) } };
    } else if (isDuplicateKey(err)) {
      status = 409;
      body = { error: { code: 'DUPLICATE', message: 'A record with these details already exists' } };
    } else if (bodyParserType(err) === 'entity.parse.failed') {
      status = 400;
      body = { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } };
    } else if (bodyParserType(err) === 'entity.too.large') {
      status = 413;
      body = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } };
    }

    if (status >= 500) {
      logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
    }
    res.status(status).json(body);
  };
}
