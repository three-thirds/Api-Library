import { Hono } from "hono";

const app = new Hono();

const HACKATIME_BASE = "https://hackatime.hackclub.com";

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_5M = 5 * 60 * 1000;
const CACHE_TTL_1M = 60 * 1000;

//A small helper to convert seconds to hour
function secondsToHours(secs: number) {
  return +(secs / 3600).toFixed(1);
}

app.get("/user/:username", async (c) => {
  const username = c.req.param('username');
  const noAi = c.req.query('no_ai') === 'true';
  const cacheKey = `user:${username}:noai_${noAi}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json({ ...cached.data, cached: true });
  }

  try {
    const params = new URLSearchParams({ features: 'languages,projects,editors' });

    if (noAi) params.append('no_ai_coding', 'true');

    const url = `${HACKATIME_BASE}/api/v1/users/${encodeURIComponent(username)}/stats?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ApiContrib-Hackatime/1.0'
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 403) {
      return c.json({ error: `User '${username}' has disabled public stats lookup.` }, 403);
    }
    if (res.status === 404) {
      return c.json({ error: `User '${username}' not found.` }, 404);
    }
    if (!res.ok) {
      return c.json({ error: `Hackatime upstream error: HTTP ${res.status}` }, 502);
    }

    const json = await res.json();
    const data = json.data;

    const cleanData = {
      username,
      total_seconds: Math.round(data.total_seconds ?? 0),
      total_hours: secondsToHours(data.total_seconds ?? 0),
      daily_average_hours: secondsToHours(data.daily_average ?? 0),
      languages: (data.languages ?? []).map((l: any) => ({
        name: l.name,
        hours: secondsToHours(l.total_seconds ?? 0),
        percent: l.percent
      })),
      projects: (data.projects ?? []).map((p: any) => ({
        name: p.name,
        hours: secondsToHours(p.total_seconds),
        percent: p.percent
      })),
      editors: (data.editors ?? []).map((e: any) => ({
        name: e.name,
        hours: secondsToHours(e.total_seconds),
        percent: e.percent
      })),
      streak: data.streak ?? 0,
      trust_factor: json.trust_factor?.trust_level ?? 'unknown',
    };

    cache.set(cacheKey, {
      data: cleanData,
      expiresAt: Date.now() + CACHE_TTL_5M,
    });

    return c.json({ ...cleanData, cached: false });
  } catch (err) {
    return c.json({ error: 'Failed to fetch user stats', details: String(err) }, 500);
  }
});


app.get('/currently_hacking', async (c) => {
  const cacheKey = 'currently_hacking';

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json({ ...cached.data, cached: true });
  }

  try {
    const res = await fetch(`${HACKATIME_BASE}/api/v1/currently_hacking`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return c.json({ error: 'Failed to fetch currently hacking users' }, res.status as any);
    }

    const data = await res.json();

    cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_1M
    });

    return c.json({ ...data, cached: false });
  } catch (err) {
    return c.json({ error: 'Failed to query live hackers', derails: String(err) }, 500);
  }

});

export default app;
