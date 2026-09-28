import { Hono } from "hono";
import { type AuthEnv, requiresApiKey } from "../middleware/auth";

const app = new Hono<AuthEnv>();

app.use('*', requiresApiKey);

app.get('/weather/:city', async (c) => {
  const city = c.req.param('city');
  const vault = c.get('vault');

  const apiKey = vault.secrets['openweather'];

  if (!apiKey) {
    return c.json({
      error: 'Missing upstream credential',
      message: 'No "openweather" key found in the vault. Add one via POST /keys/secrets ',
    }, 400);
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      return c.json({ error: `OpenWeather returned HTTP: ${res.status}` }, 502);
    }

    const data = await res.json();

    return c.json({
      city: data.name,
      country: data.sys?.country,
      temperature_c: data.main?.temp,
      conditions: data.weather?.[0]?.description,
      proxied_for: vault.name,
    });
  } catch (err) {
    return c.json({ error: 'Failed to proxy weather request', details: String(err) }, 500);
  }
});

export default app;
