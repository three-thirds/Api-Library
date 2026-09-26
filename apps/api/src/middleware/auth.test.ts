import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { requiresApiKey, type AuthEnv } from './auth';
import { generateMasteKey as generateMasterKey, saveVault, sha256, UserVault } from '../lib/vault';

describe('Middleware works (requiresApiKey)', () => {
  const app = new Hono<AuthEnv>();
  app.use('/test-protected', requiresApiKey);
  app.get('/test-protected', (c) => {
    const vault = c.get('vault');
    return c.json({ message: `Welcome, ${vault.name}!~`, userId: vault.userId });
  });

  it('returns 401 when no API key is provided', async () => {
    const res = await app.request('/test-protected');
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Missing API key');
  });

  it('returns 403 when no garbage API key is provided', async () => {
    const res = await app.request('/test-protected', {
      headers: { Authorization: 'Bearer al_live_fakekeythatdoesnothing67676' }
    });
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toContain('Invalid or revoked');
  });

  it('Return 200 on valid key and inject the vault', async () => {
    const validKey = generateMasterKey();
    const hash = await sha256(validKey);
    const mockVault: UserVault = {
      userId: 'test_chish_uuid',
      name: 'Chish',
      createdAt: new Date().toISOString(),
      secrets: { openweather: 'mock_openweather_token' }
    };
    await saveVault(null, hash, mockVault);

    const res = await app.request('/test-protected', {
      headers: { Authorization: `Bearer ${validKey}` }
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.message).toBe('Welcome, Chish!~');
    expect(json.userId).toBe('test_chish_uuid');
  });

  it('allows access using the X-API-Key fallback header', async () => {
    const validKey = generateMasterKey();
    const hash = await sha256(validKey);
    const mockVault: UserVault = {
      userId: 'test_chish_uuid',
      name: 'Chish',
      createdAt: new Date().toISOString(),
      secrets: {}
    };
    await saveVault(null, hash, mockVault);

    const res = await app.request('/test-protected', {
      headers: { 'X-API-Key': validKey }
    });
    expect(res.status).toBe(200);
  });


});
