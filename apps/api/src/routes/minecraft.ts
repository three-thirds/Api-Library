import { Hono } from "hono";

const app = new Hono();

app.get("/:server", async (c) => {
  const server = c.req.param("server");

  try {
    const upstreamRes = await fetch(`https://api.mcsrvstat.us/3/${server}`);

    if (!upstreamRes.ok) {
      return c.json({ error: 'Failed to query server' }, 502);
    }

    const data = await upstreamRes.json();

    return c.json({
      online: data.online,
      ip: data.ip || server,
      port: data.port,
      version: data.version || 'Unknown',
      players: {
        online: data.players?.online ?? 0,
        max: data.players?.max ?? 0,
      },
      motd: data.motd?.clean?.join(' ') || 'No description',
    });
  } catch (err) {
    return c.json({ error: 'Internal Server Error', details: String(err) }, 500);
  }
});

export default app;
