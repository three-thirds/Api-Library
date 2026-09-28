import { describe, expect, it } from "bun:test";
import cratesApp from './crates';

describe('Crates/io (route)', () => {
  it('GET /:name fetches real data and normalizes it for serde', async () => {
    const res = await cratesApp.request('/serde');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.name).toBe('serde');
    expect(json.max_version).toBeDefined();
    expect(json.downloads.total).toBeGreaterThan(100000);
    expect(json.crates_io_url).toBe('https://crates.io/crates/serde');
  });

  it('GET /:name returns 404 for wrong crate name', async () => {
    const res = await cratesApp.request('/fake-ass-tung-tung-crate-6769');
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toContain('not found');

  });
});
