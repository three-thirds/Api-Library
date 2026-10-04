import { Hono } from "hono";
import { stringBufferToString } from "hono/utils/html";

const app = new Hono();

function formatDuration(minutes: number) {
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}` : `${mins}m`;
}

app.post('/analyze', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.text !== 'string' || !body.text.trim()) {
    return c.json({ error: 'Request body must include non empty "text" string' }, 400);
  }

  const text = body.text.trim();

  const charsWithSpaces = text.length;
  const charsWithoutSpaces = text.replace(/\s+g/, '').length;

  const wordsArray = text.match(/\b\w+\b/g) ?? [];
  const wordCount = wordsArray.length;

  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length || (wordCount > 0 ? 1 : 0);
  const paragraphs = text.split(/\n\s*\n/).filter((p: any) => p.trim().length > 0).length || 1;

  const readingMinutes = wordCount / 200;
  const speakingMinutes = wordCount / 130;

  return c.json({
    metrics: {
      words: wordCount,
      characters: charsWithSpaces,
      characters_no_spaces: charsWithoutSpaces,
      sentences,
      paragraphs,
    },
    reading_time: {
      minutes: +readingMinutes.toFixed(2),
      formatted: formatDuration(readingMinutes),
    },
    speaking_time: {
      minutes: +speakingMinutes.toFixed(2),
      formatted: formatDuration(speakingMinutes),
    }
  });
});

export default app;
