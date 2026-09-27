import { Hono } from "hono";

const app = new Hono();

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 100;

app.get('/:name', async (c) => {
  const crateName = c.req.param('name').toLowerCase().trim();
  const cacheKey = `crate:${crateName}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json({ ...cached.data, cached: true });
  }

  try {
    const res = await fetch(`https://crates.io/api/v1/crates/${encodeURIComponent(crateName)}`, {
      headers: {
        'User-Agent': 'ApiLibrary-CratesInspector/1.0 (https://github.com/three-thirds)',
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 404) {
      return c.json({ error: `Crate '${crateName} not found on crates.io'` }, 404);
    }

    if (!res.ok) {
      return c.json({ error: `Crates.io returned HTTP ${res.status}` }, 502);
    }

    const data = await res.json();
    const crate = data.crate;

    const cleanData = {
      name: crate.name,
      max_version: crate.max_version,
      description: crate.description ?? 'No Description',
      downloads: {
        total: crate.downloads,
        recent: crate.recent_downloads ?? 0,
      },
      repository: crate.repository ?? null,
      documentation: crate.documentation ?? `https://docs.rs/${crate.name}`,
      crates_io_url: `https://crates.io/crates/${crate.name}`,
      updated_at: crate.updated_at
    };

    cache.set(cacheKey, {
      data: cleanData,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return c.json({ ...cleanData, cached: false });
  } catch (err) {
    return c.json({ error: 'Failed to query crates.io', details: String(err) });
  }
});

export default app;
