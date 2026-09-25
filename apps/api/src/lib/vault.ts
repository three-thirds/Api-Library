const localMemoryStore = new Map<string, string>();

export interface UserVault {
  userId: string,
  name: string,
  createdAt: string,
  secrets: Record<string, string> //{"github": "ciusf12738asaz"}
}

/**
 * Computes the SHA-256 hash using web crypto API
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a safe, cryptographic random Api-Library key
 * format: al_live_<32 random chars>
 */
export function generateMasteKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `al_live_${hex}`;
}

/**
 * Retrieves a user's vault given the SHA-256 hash of their key
 */
export async function getVaultByHash(kv: any, keyHash: string): Promise<UserVault | null> {
  const storageKey = `vault:${keyHash}`;

  let rawData: string | null = null;
  if (kv && typeof kv.get === 'function') {
    rawData = await kv.get(storageKey);
  } else {
    rawData = localMemoryStore.get(storageKey) ?? null;
  }

  if (!rawData) return null;
  try {
    return JSON.parse(rawData);
  } catch (err) {
    return null;
  }
}

/**
 * Saves or updates a user's vault
 */
export async function saveVault(kv: any, keyHash: string, vault: UserVault): Promise<void> {
  const storageKey = `vault:${keyHash}`;
  const serialized = JSON.stringify(vault);

  if (kv && typeof kv.put === 'function') {
    await kv.put(storageKey, serialized);
  } else {
    localMemoryStore.set(storageKey, serialized);
  }
}
