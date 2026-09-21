import { Hono } from 'hono';

const app = new Hono();

app.get('/ping', (c) => {
    return c.json({
        ok: true,
        message: 'pong'
    })
})

export default app