import { Hono } from 'hono';

const app = new Hono();
// const cache = new Map<string, { data: any; expiresAt: number }>();
// const CACHE_TTL_MS = 60 * 1000;

app.get("/", async (c) => {
    const lat = c.req.queries("latitude");
    const lon = c.req.queries("longitude");

    const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast`

    if (!lat || !lon) {
        return c.json({ error: "Missing latitude or longitude query parameters" }, 400);
    }

    const upstream = new URLSearchParams(c.req.query());
    try {
        const response = await fetch(`${OPEN_METEO_URL}?${upstream.toString()}`);

        if (!response.ok) {
            const errormeessage = await response.json().catch(() => null);
            return c.json({ error: "Failed to fetch weather data", errormeessage }, 502);
        }

            const data = await response.json();
            return c.json(data);
    } catch (error) {
        return c.json({ error: "An error occurred while fetching weather data" }, 500);
    }
});

export default app;