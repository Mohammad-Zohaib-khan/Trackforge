import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setCsrfToken, toQueryString } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('api client', () => {
  it('sends the in-memory CSRF token on mutations only and includes credentials', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('token-123');
    await api.get('/transactions');
    await api.post('/transactions', { a: 1 });
    const [, getInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((getInit.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
    expect((postInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('token-123');
    expect(postInit.credentials).toBe('include');
  });

  it('turns error bodies into ApiError with field messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'Some fields need attention', fields: { amount: 'Bad' } } })));
    const err = await api.post('/transactions', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fields).toEqual({ amount: 'Bad' });
  });

  it('refreshes the CSRF token once and retries when it is rejected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: 'CSRF_TOKEN_INVALID', message: 'x' } }))
      .mockResolvedValueOnce(jsonResponse(200, { user: {}, csrfToken: 'fresh' }))
      .mockResolvedValueOnce(jsonResponse(201, { done: true }));
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('stale');
    await expect(api.post('/categories', { name: 'x' })).resolves.toEqual({ done: true });
    const [, retryInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect((retryInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('fresh');
  });

  it('builds query strings without empty values', () => {
    expect(toQueryString({ a: 'x', b: '', c: undefined, d: 2 })).toBe('?a=x&d=2');
    expect(toQueryString({})).toBe('');
  });
});
