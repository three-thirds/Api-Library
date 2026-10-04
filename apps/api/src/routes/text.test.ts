import { describe, expect, it } from 'bun:test';
import textApp from './text';

describe('Text Metrics Analyzer (text.ts)', () => {
  it('POST /analyze calculates correct word count and reading time', async () => {
    const sampleText = 'Three Thirds are goated and will get those 1k$! for sure!';

    const res = await textApp.request('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sampleText }),
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.metrics.words).toBe(11);
    expect(json.metrics.sentences).toBe(2);
    expect(json.reading_time.formatted).toBeDefined();
    expect(json.speaking_time.formatted).toBeDefined();
  });

  it('POST /analyze rejects empty text with 400', async () => {
    const res = await textApp.request('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('non empty');
  });
});
