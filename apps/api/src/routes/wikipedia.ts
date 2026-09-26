import { Hono } from 'hono';

const app = new Hono();

const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/rest.php/v1";
const WIKIPEDIA_HEADERS = {
    Accept: "application/json",
    "User-Agent": "Api-Library/1.0 (https://github.com/willgob/Api-Library)",
};

function encodeTitle(title: string) {
    return encodeURIComponent(title.replace(/ /g, "_"));
}

async function proxy(c: any, upstreamPath: string) {
    const url = new URL(`${WIKIPEDIA_API_URL}${upstreamPath}`);
    for (const [key, value] of Object.entries(c.req.query())) {
        url.searchParams.append(key, value as string);
    }

    try {
        const res = await fetch(url.toString(), { headers: WIKIPEDIA_HEADERS });
        if(res.status === 404) {
            return c.json({ error: 'Not found'}, 404);
        }
        if(!res.ok) {
            const message = await res.json().catch(() => null);
            return c.json({ error: 'Failed to fetch data from Wikipedia', message, status: res.status }, 502);
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('json')) {
            return c.json(await res.json());
        }
        return c.text(await res.text());
    } catch (error) {
        return c.json({ error: 'An error occurred while fetching data from Wikipedia', details: (error as Error).message }, 500);
    }
}

app.get('/page/:title/history', (c) => proxy(c, `/page/${encodeTitle(c.req.param('title'))}/history`))
// app.get('')


export default app;