import { Hono } from 'hono';

const app = new Hono();

app.get("/", async (c) => {
    const response = await fetch("http://api.open-notify.org/iss-now.json");
    if (!response.ok) {
        return c.json({ error: "Failed to fetch ISS location data" }, 502);
    }

    const data = await response.json();
    return c.json(data);
})

export default app;