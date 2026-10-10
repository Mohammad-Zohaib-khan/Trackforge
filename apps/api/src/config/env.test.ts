import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';

const base = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/trackforge',
  SESSION_SECRET: 'a-sufficiently-long-random-secret-value-123456',
};

describe('loadConfig', () => {
  it('applies safe defaults for development', () => {
    const config = loadConfig({ ...base });
    expect(config.isProduction).toBe(false);
    expect(config.session.secureCookie).toBe(false);
    expect(config.appOrigins).toEqual(['http://localhost:5173']);
  });

  it('fails fast on missing or weak secrets without echoing values', () => {
    expect(() => loadConfig({ MONGODB_URI: base.MONGODB_URI, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ SESSION_SECRET: base.SESSION_SECRET })).toThrow(/MONGODB_URI/);
    try {
      loadConfig({ MONGODB_URI: 'postgres://secret-host', SESSION_SECRET: base.SESSION_SECRET });
    } catch (err) {
      expect(String(err)).not.toContain('secret-host');
    }
  });

  it('enforces production hardening', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SESSION_SECRET: 'change-me-to-a-long-random-value-at-least-32-chars', APP_ORIGINS: 'https://app.example.com' })).toThrow(/placeholder/);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', APP_ORIGINS: 'http://app.example.com' })).toThrow(/HTTPS/);
    const prod = loadConfig({ ...base, NODE_ENV: 'production', APP_ORIGINS: 'https://app.example.com', TRUST_PROXY: '1' });
    expect(prod.session.secureCookie).toBe(true);
    expect(prod.trustProxy).toBe(1);
  });
});
