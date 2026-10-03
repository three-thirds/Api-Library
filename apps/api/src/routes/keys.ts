import { Hono } from "hono";
import { requiresApiKey, type AuthEnv } from "../middleware/auth";
import { generateMasteKey, saveVault, sha256, UserVault } from "../lib/vault";

const app = new Hono<AuthEnv>();

app.post('/create', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = body.name ?? 'Default User';

  const rawKey = generateMasteKey();
  const keyHash = await sha256(rawKey);

  const initialVault: UserVault = {
    userId: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    secrets: {},
  };

  const kv = (c.env as any)?.VAULT_KV;
  await saveVault(kv, keyHash, initialVault);
  console.log('[KEYS CREATE] Storing hash:', keyHash, 'KV active:', !!kv);
  return c.json({
    message: 'Master Key successfully created! Store it safely, it will never be displayed again',
    master_key: rawKey,
    user_id: initialVault.userId,
    name: initialVault.name,
  },
    201
  );
});

app.post('/secrets', requiresApiKey, async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || !body.provider || !body.secret) {
    return c.json({ error: "Request body must include 'provider' or 'secret'" }, 400);
  }

  const provider = String(body.provider).toLowerCase().trim();
  const secret = String(body.secret).trim();

  const vault = c.get('vault');
  const keyHash = c.get('keyHash');
  const kv = (c.env as any)?.VAULT_KV;

  vault.secrets[provider] = secret;
  await saveVault(kv, keyHash, vault);

  return c.json({
    message: `Successfully saved secret for provider: '${provider}'`, provider
  });
});

app.get('/secrets', requiresApiKey, async (c) => {
  const vault = c.get('vault');

  const maskedSecrets: Record<string, string> = {};
  for (const [provider, secrets] of Object.entries(vault.secrets)) {
    if (secrets.length > 8) {
      maskedSecrets[provider] = `${secrets.slice(0, 4)}...${secrets.slice(-4)}`;
    } else {
      maskedSecrets[provider] = 'configured';
    }
  }

  return c.json({
    user_id: vault.userId,
    name: vault.name,
    configured_secrets: maskedSecrets
  });
});


export default app;
