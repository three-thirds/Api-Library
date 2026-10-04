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
    const geoUrl = `http://api.openweather.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });

    if (!geoRes.ok) {
      const errText = geoRes.text();
      return c.json({ error: `Geocoding failed :c... HTTP: ${geoRes.status}`, details: errText }, 502);
    }

    const geoData = (await geoRes.json()) as Array<{ lat: number; lon: number; name: string; country: string }>;
    if (!geoData || geoData.length === 0) {
      return c.json({ error: `City ${city} not found.` }, 404);
    }

    const { lat, lon, name, country } = geoData[0];

    const weatherUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const weatherRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(5000) });

    if (!weatherRes.ok) {
      const errText = await weatherRes.text();
      return c.json({ error: `OpenWeather returned HTTP: ${weatherRes.status}`, details: errText }, 502);
    }

    const weatherData = (await weatherRes.json()) as any;

    return c.json({
      city: name,
      country,
      coordinates: { lat, lon },
      temperature_c: weatherData.main?.temp,
      feels_like_c: weatherData.main?.feels_like,
      humidity: weatherData.main?.humidity,
      conditions: weatherData.weather?.[0]?.description,
      proxied_for: vault.name,
    });
  } catch (err) {
    return c.json({ error: 'Failed to proxy weather request', details: String(err) }, 500);
  }
});

export default app;
