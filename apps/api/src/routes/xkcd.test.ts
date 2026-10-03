import { describe, expect, it } from "bun:test";
import xkcdApp from './xkcd';

describe('XKCD Comic Explorer (xkcd.ts)', () => {
  it('GET /latest returns latest comic', async () => {
    const res = await xkcdApp.request('/latest');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.id).toBeGreaterThan(3000);
    expect(json.title).toBeDefined();
    expect(json.image_url.startsWith("https:/")).toBe(true);
    expect(json.published_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('GET /327 fetches the goated lil bobby comic', async () => {
    const res = await xkcdApp.request('/327');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.id).toBe(327);
    expect(json.title).toBe('Exploits of a Mom');
    expect(json.alt_text).toContain('license factory');
  });

  it('GET /invalid returns 404 bad request', async () => {
    const res = await xkcdApp.request('/notanumber');
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('Invalid comic ID');
  });
});
