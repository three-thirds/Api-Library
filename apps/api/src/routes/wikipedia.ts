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

// --- page ---
app.get('/page/:title', (c) => proxy(c, `/page/${encodeTitle(c.req.param('title'))}`));                          // Get page source
app.get('/page/:title/bare', (c) => proxy(c, `/page/${encodeTitle(c.req.param('title'))}/bare`));                // Get page
app.get('/page/:title/html', (c) => proxy(c, `/page/${encodeTitle(c.req.param('title'))}/html`));                // Get HTML
app.get('/page/:title/with_html', (c) => proxy(c, `/page/${encodeTitle(c.req.param('title'))}/with_html`));      // Get page with HTML
app.get('/page/:title/lint', (c) => proxy(c, `/page/${encodeTitle(c.req.param('title'))}/lint`));                // Get page lint errors
app.get('/page/:title/history', (c) => proxy(c, `/page/${encodeTitle(c.req.param('title'))}/history`));          // Get page history
app.get('/page/:title/history/counts/:type', (c) =>
  proxy(c, `/page/${encodeTitle(c.req.param('title'))}/history/counts/${c.req.param('type')}`));                 // Get page history counts
app.get('/page/:title/links/language', (c) =>
  proxy(c, `/page/${encodeTitle(c.req.param('title'))}/links/language`));                                        // Get languages
app.get('/page/:title/links/media', (c) =>
  proxy(c, `/page/${encodeTitle(c.req.param('title'))}/links/media`));                                           // Get files on page

// --- revision ---
app.get('/revision/:id', (c) => proxy(c, `/revision/${c.req.param('id')}`));                                     // Get revision source
app.get('/revision/:id/bare', (c) => proxy(c, `/revision/${c.req.param('id')}/bare`));                           // Get revision
app.get('/revision/:id/html', (c) => proxy(c, `/revision/${c.req.param('id')}/html`));                           // Get revision HTML
app.get('/revision/:id/with_html', (c) => proxy(c, `/revision/${c.req.param('id')}/with_html`));                 // Get revision with HTML
app.get('/revision/:id/lint', (c) => proxy(c, `/revision/${c.req.param('id')}/lint`));                           // Get revision lint errors
app.get('/revision/:from/compare/:to', (c) =>
  proxy(c, `/revision/${c.req.param('from')}/compare/${c.req.param('to')}`));                                    // Compare revisions

// --- search ---
app.get('/search', (c) => proxy(c, '/search'));                                                                  // OpenSearch description doc
app.get('/search/page', (c) => proxy(c, '/search/page'));                                                        // List pages by search query
app.get('/search/title', (c) => proxy(c, '/search/title'));                                                      // List pages by title query

// --- file ---
app.get('/file/:title', (c) => proxy(c, `/file/${encodeTitle(c.req.param('title'))}`));                          // Get file
app.get('/file/:title/thumbnails', (c) => proxy(c, `/file/${encodeTitle(c.req.param('title'))}/thumbnails`));    // Get file thumbnails


export default app;