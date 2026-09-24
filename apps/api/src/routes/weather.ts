import { Hono } from 'hono';

const app = new Hono();
// const cache = new Map<string, { data: any; expiresAt: number }>();
// const CACHE_TTL_MS = 60 * 1000;

app.get("/", async (c) => {
    try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m");

        if (!response.ok) {
            return c.json({ error: "Failed to fetch weather data" }, 502);
        }

            const data = await response.json();
            return c.json(data);
    } catch (error) {
        return c.json({ error: "An error occurred while fetching weather data" }, 500);
    }
});

export default app;