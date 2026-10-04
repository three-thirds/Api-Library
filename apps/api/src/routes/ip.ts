import { Hono } from "hono";

const app = new Hono();

function getClientIp(c: any): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    '127.0.0.1'
  );
}

app.get('/', (c) => {
  const ip = getClientIp(c);
  const country = c.req.header('cf-ipcountry') || 'Unknown';
  const userAgent = c.req.header('user-agent') || 'Unknown';
  const rayId = c.req.header('cf-ray') || 'local-dev';

  return c.json({
    ip,
    country,
    user_agent: userAgent,
    edge_ray_id: rayId,
    timestamp: new Date().toISOString()
  });
});


app.get('/raw', (c) => {
  const ip = getClientIp(c);
  return c.text(`${ip}\n`, 200, {
    'Content-Type': 'text/plain'
  });
});

app.get('/headers', (c) => {
  const rawHeaders = c.req.raw.headers;
  const headerMap: Record<string, string> = {};

  rawHeaders.forEach((val, key) => {
    headerMap[key] = val;
  });

  return c.json({
    ip: getClientIp(c),
    total_headers: Object.keys(headerMap).length,
    headers: headerMap,
  });

});

export default app;
