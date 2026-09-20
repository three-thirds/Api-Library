import { Hono } from 'hono';

const app = new Hono<{ Bindings: { ASSETS: Fetcher } }>();

app.get('/ping', (c) => c.json({ ok: true, data: 'pong' }));

// anything not matched above falls through to the Svelte build
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;