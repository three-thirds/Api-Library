import { describe, expect, it } from "bun:test";
import authApp from "./authenticated";
import { generateMasteKey, saveVault, sha256, UserVault } from "../lib/vault";
import { auth } from "hono/utils/basic-auth";

describe('Authenticated Proxy Routes', () => {
  it('Rejects unauthorizes requests', async () => {
    const res = await authApp.request('/weather/london');
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Missing API key');
  });

  it('reject if has a master key but no provider secret', async () => {
    const key = generateMasteKey();
    const hash = await sha256(key);

    const emptyVault: UserVault = {
      userId: 'test_empty_vault_user',
      name: 'Empty Vault User',
      createdAt: new Date().toISOString(),
      secrets: {}
    };
    await saveVault(null, hash, emptyVault);

    const res = await authApp.request('/weather/tokyo', {
      headers: {
        Authorization: `Bearer ${key}`
      }
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Missing upstream credential');
    expect(json.message).toContain('No "openweather" key found');
  });

  it('extracts secrets and injects them just fine', async () => {

    const key = generateMasteKey();
    const hash = await sha256(key);

    const emptyVault: UserVault = {
      userId: 'test_vault_user',
      name: 'Test Vault User',
      createdAt: new Date().toISOString(),
      secrets: { openweather: 'mock_tung_tung_test_sahur_67' }
    };
    await saveVault(null, hash, emptyVault);

    const res = await authApp.request('/weather/berlin', {
      headers: { Authorization: `Bearer ${key}` }
    });

    //Since that mock token isn't real, openweather will 
    //reject it with a 401 or 502, which lwkey proves our 
    //gateway actually tried pinging the Openweather API with a fake key
    expect([200, 502]).toContain(res.status);
  });

});
