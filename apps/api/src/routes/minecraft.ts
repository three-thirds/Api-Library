import { Hono } from "hono";

const app = new Hono();
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

app.get("/:server", async (c) => {
  const server = c.req.param("server");

  const cached = cache.get(server);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json({ ...cached.data, cached: true });
  }

  try {
    const upstreamRes = await fetch(`https://api.mcsrvstat.us/3/${server}`);

    if (!upstreamRes.ok) {
      return c.json({ error: 'Failed to query server' }, 502);
    }

    const data = await upstreamRes.json();

    const cleanData = {
      online: data.online,
      ip: data.ip || server,
      port: data.port,
      version: data.version || 'Unknown',
      players: {
        online: data.players?.online ?? 0,
        max: data.players?.max ?? 0,
      },
      motd: data.motd?.clean?.join(' ') || 'No description',
    };

    cache.set(server, {
      data: cleanData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return c.json({
      ...cleanData, cached: false
    });
  } catch (err) {
    return c.json({ error: 'Internal Server Error', details: String(err) }, 500);
  }
});

export default app;
