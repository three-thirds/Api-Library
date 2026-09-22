import { Hono } from 'hono';

const ping = new Hono();

ping.get('/', (c) => {
	return c.json({
		ok: true,
		message: 'pong'
	});
});

export default ping;