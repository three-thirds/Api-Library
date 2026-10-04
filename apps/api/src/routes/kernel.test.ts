import { describe, expect, it } from "bun:test";
import kernelApp from './kernel';

describe('Linux Kernel Auditor (kernel.ts)', () => {
  it('GET /latest returns active stable and mainstream kernel versions', async () => {
    const res = await kernelApp.request('/latest');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.stable).toBeDefined();
    expect(json.active_lts_branches.length).toBeGreaterThan(0);
    expect(json.source).toBe('https://kernel.org');
  });

  it('GET /check/:version audits a version and returns EOL analysis', async () => {
    const res = await kernelApp.request('/check/6.1.100');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.branch).toBe('6.1');
    expect(json.status).toBeDefined();
    expect(typeof json.is_eol).toBe('boolean');
    expect(json.recommendation).toBeDefined();
  });

  it('GET /check/:version rejects invalid version strings with 400', async () => {
    const res = await kernelApp.request('/check/invalidversionstring');
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('Invalid version format');
  });
})
