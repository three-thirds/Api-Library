import { describe, expect, it } from 'bun:test';
import ipApp from './ip';

describe('Netword IP tests', () => {
  it('GET / returns client IP and metadata from headers', async () => {
    const res = await ipApp.request('/', {
      headers: {
        'cf-connecting-ip': '203.0.113.195', //got this IP from AI... I asked it what IP could i use for tests and it said this one is reserved
        'cf-ipcountry': 'IN',
        'user-agent': 'TestRunner/6.7'
      },
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ip).toBe('203.0.113.195');
    expect(json.country).toBe('IN');
    expect(json.user_agent).toBe('TestRunner/6.7');
    expect(json.timestamp).toBeDefined();
  });

  it('GET /raw returns plaintext IP', async () => {
    const res = await ipApp.request('/raw', {
      headers: { 'cf-connecting-ip': '198.51.100.42' }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('GET /headers echoes incoming headers as a dictionary', async () => {
    const res = await ipApp.request('/headers', {
      headers: {
        'x-custom-test-header': 'systems-engineering-rocks',
      }
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.headers['x-custom-test-header']).toBe('systems-engineering-rocks');
  });
});
