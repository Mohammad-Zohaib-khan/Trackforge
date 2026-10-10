import type { ApiErrorBody } from '@trackforge/shared';

/**
 * Thin fetch client for /api/v1.
 * - Session lives in an HttpOnly cookie the browser manages; nothing auth-related
 *   is written to localStorage.
 * - The CSRF synchronizer token is kept in memory only and sent on mutations.
 */

const BASE = `${(import.meta.env.VITE_API_URL as string | undefined) ?? ''}/api/v1`;

let csrfToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'object' &&
    (value as { error: { message?: unknown } }).error !== null &&
    typeof (value as { error: { message?: unknown } }).error.message === 'string'
  );
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function toQueryString(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

async function refreshCsrf(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/me`, { credentials: 'include', headers: { Accept: 'application/json' } });
  if (!res.ok) return false;
  const data = (await res.json()) as { csrfToken?: unknown };
  if (typeof data.csrfToken !== 'string') return false;
  csrfToken = data.csrfToken;
  return true;
}

async function send(method: string, path: string, options: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${toQueryString(options.query)}`, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach TrackForge. Check your connection and try again.');
  }

  if (res.ok) return res;

  const body: unknown = await res.json().catch(() => null);
  const error = isErrorBody(body)
    ? new ApiError(res.status, body.error.code, body.error.message, body.error.fields ?? {})
    : new ApiError(res.status, 'HTTP_ERROR', `Request failed (${res.status})`);

  if (error.code === 'CSRF_TOKEN_INVALID' && !retried && (await refreshCsrf())) {
    return send(method, path, options, true);
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthenticated?.();
  throw error;
}

async function json<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => json<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => json<T>('POST', path, { body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => json<T>('PATCH', path, { body }),
  delete: <T = void>(path: string, body?: unknown) => json<T>('DELETE', path, body === undefined ? {} : { body }),
  /** Downloads a file response (CSV export) and returns it as a Blob with its filename. */
  download: async (path: string, query?: Query): Promise<{ blob: Blob; filename: string; rows: number | null }> => {
    const res = await send('GET', path, { query });
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const rows = res.headers.get('X-Export-Row-Count');
    return { blob: await res.blob(), filename: match?.[1] ?? 'export.csv', rows: rows ? Number(rows) : null };
  },
};

export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fields : {};
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Try again.';
}
