import { Hono } from 'hono';

const app = new Hono();

app.get("/", async (c) => {
    const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

})

export default app;