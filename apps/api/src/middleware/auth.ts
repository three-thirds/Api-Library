import { createMiddleware } from "hono/factory";
import { getVaultByHash, sha256, UserVault } from "../lib/vault";

export type AuthEnv = {
  Variables: {
    vault: UserVault,
    keyHash: string,
  }
};

export const requiresApiKey = createMiddleware(async (c, next) => {
  //extract key from header
  const authHeader = c.req.header('Authorization');
  let rawKey = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.slice(7).trim();
  } else {
    rawKey = c.req.header("X-API-Key") ?? '';
  }

  if (!rawKey) {
    return c.json({ error: 'Missing API key, Pass via Authorization: Bearer <key> or X-API-Key' }, 401);
  }

  //Hash the key and look em up in da storage
  const keyHash = await sha256(rawKey);
  const kv = (c.env as any)?.VAULT_KV;
  console.log('[AUTH BOUNCER] Checking hash:', keyHash, 'KV active:', !!kv);
  const vault = await getVaultByHash(kv, keyHash);

  if (!vault) {
    return c.json({ error: "Invalid or revoked API key" }, 403);
  }

  c.set('vault', vault);
  c.set('keyHash', keyHash);

  await next();

});


