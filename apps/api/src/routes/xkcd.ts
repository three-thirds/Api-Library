import { Hono } from "hono";
import { DetailedError } from "hono/client";

const app = new Hono();

const cache = new Map<string, { data: any, expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 100;

//https://xkcd.com/info.0.json
interface Xkcd {
  num: number;
  title: string;
  img: string;
  alt: string;
  year: string;
  month: string;
  day: string;
}


async function fetchXkcd(id?: number) {
  const url = id ? `https://xkcd.com/${id}/info.0.json` : 'https://xkcd.com/info.0.json'

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (res.status === 404 || id === 404) return null;
  if (!res.ok) throw new Error(`XKCD returned HTTPS: ${res.status}`);

  return (await res.json()) as Xkcd;
}

function normalizeXkcd(raw: Xkcd) {
  const month = raw.month.padStart(2, '0');
  const day = raw.day.padStart(2, '0');

  return {
    id: raw.num,
    title: raw.title,
    image_url: raw.img,
    alt_text: raw.alt,
    published_date: `${raw.year}-${month}-${day}`,
    permalink: `https://xkcd.com/${raw.num}`
  };
}

app.get('/latest', async (c) => {
  try {
    const raw = await fetchXkcd();
    if (!raw) return c.json({ error: 'Failed to fetch latest comic' }, 502);
    return c.json(normalizeXkcd(raw));
  } catch (err) {
    return c.json({ error: 'Failed to fetch the latest comic :c', details: String(err) }, 500);
  }
});

app.get('/random', async (c) => {
  try {
    const latest = await fetchXkcd();
    if (!latest) return c.json({ error: 'Failed to fetch latest comic metadata' }, 502);

    let randomId = Math.floor(Math.random() * latest.num) + 1;
    if (randomId === 404) randomId = 405;

    const raw = await fetchXkcd(randomId);
    if (!raw) return c.json({ error: 'Failed to fetch random comic' }, 502);

    return c.json(normalizeXkcd(raw));
  } catch (err) {
    return c.json({ error: 'Failed to fetch the latest comic :c', details: String(err) }, 500);
  }
});

app.get('/:id', async (c) => {
  const idParam = c.req.param('id');
  const id = parseInt(idParam);

  if (isNaN(id) || id <= 0) {
    return c.json({ error: 'Invalid comic ID. Must be a non-zero positive.' }, 400);
  }

  const cacheKey = `xkcd:${id}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json({ ...cached.data, cached: true });
  }

  try {
    const raw = await fetchXkcd(id);
    if (!raw) return c.json({ error: `Comic: #${id} does not exist` }, 404);

    const clean = normalizeXkcd(raw);
    cache.set(cacheKey, { data: clean, expiresAt: Date.now() + CACHE_TTL_MS });

    return c.json({ ...clean, cached: false });
  } catch (error) {
    return c.json({ error: `Failed to fetch comic #${id}`, details: String(error) }, 500);
  }

});


export default app;
