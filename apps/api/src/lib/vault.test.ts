import { describe, expect, it } from "bun:test";
import { generateMasteKey, getVaultByHash, saveVault, sha256, UserVault } from "./vault";

describe("Vault Crypto & Storage stuff", () => {
  it('generates secure master key with correct prefix and entropy', () => {
    const key1 = generateMasteKey();
    const key2 = generateMasteKey();

    expect(key1.startsWith('al_live_')).toBe(true);

    expect(key1.length).toBe(40);

    expect(key1).not.toBe(key2);
  });

  it('computes deterministic SHA-256 hashes', async () => {
    const hash1 = await sha256('test_secret_stuff');
    const hash2 = await sha256('test_secret_stuff');
    const diffHash = await sha256('random_stuff');

    expect(hash1.length).toBe(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(diffHash);
  });
  it('saves and retrieves user vaults from local fallback store', async () => {
    const testKey = generateMasteKey();
    const keyHash = await sha256(testKey);

    const mockVault: UserVault = {
      userId: 'user_test_uuid_6767',
      name: 'Chish',
      createdAt: new Date().toISOString(),
      secrets: {
        openweather: "live_test_api_key_6769",
        github: "ghp_tung_tung_key",
      },
    };

    //passing kv as null so code falls back to memory store
    await saveVault(null, keyHash, mockVault);

    const retrieved = await getVaultByHash(null, keyHash);

    expect(retrieved).not.toBe(null);
    expect(retrieved?.userId).toBe('user_test_uuid_6767');
    expect(retrieved?.name).toBe('Chish');
    expect(retrieved?.secrets['openweather']).toBe('live_test_api_key_6769');
    expect(retrieved?.secrets['github']).toBe('ghp_tung_tung_key');

  });

  it('returns null on querying non existent key', async () => {
    const missing = await getVaultByHash(null, 'non_existent_hash_67');
    expect(missing).toBeNull();
  });
})
