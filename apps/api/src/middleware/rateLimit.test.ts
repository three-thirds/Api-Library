import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { rateLimiter } from "./rateLimit";

describe('Token Bucket Rate Limiter', () => {
  it('allows requests within capacity and blocks bursts exceeding limits', async () => {
    const app = new Hono();

    app.use('/test-limit', rateLimiter({ capacity: 3, refillRate: 1 }));
    app.get('/test-limit', (c) => c.json({ ok: true }));

    const res1 = await app.request('/test-limit');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('2');

    const res2 = await app.request('/test-limit');
    expect(res2.status).toBe(200);
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('1');

    const res3 = await app.request('/test-limit');
    expect(res3.status).toBe(200);
    expect(res3.headers.get('X-RateLimit-Remaining')).toBe('0');


    const res4 = await app.request('/test-limit');
    expect(res4.status).toBe(429);
    expect(res4.headers.get('Retry-After')).toBeDefined();

    const json = await res4.json();
    expect(json.error).toBe('Too Many Requests')
  });
})
