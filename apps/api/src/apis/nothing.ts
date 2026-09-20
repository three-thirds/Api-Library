import { Hono } from 'hono';

const weather = new Hono();

// WMO weather codes -> readable text (subset)
const CONDITIONS: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

// GET /weather?city=Sydney
weather.get('/', async (c) => {
  const city = c.req.query('city')?.trim();
  if (!city) {
    return c.json({ ok: false, error: 'Missing ?city=' }, 400);
  }

  try {
    // 1. city name -> coordinates
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
      { cf: { cacheTtl: 86400, cacheEverything: true } }, // city locations rarely change
    );
    const geo = (await geoRes.json()) as {
      results?: { name: string; country?: string; latitude: number; longitude: number }[];
    };
    const place = geo.results?.[0];
    if (!place) {
      return c.json({ ok: false, error: `No city found for "${city}"` }, 404);
    }

    // 2. coordinates -> current weather
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m`,
      { cf: { cacheTtl: 300, cacheEverything: true } }, // cache 5 min
    );
    const wx = (await wxRes.json()) as { current: Record<string, number> };
    const cur = wx.current;

    // 3. return a small, clean response instead of the raw upstream payload
    return c.json({
      ok: true,
      data: {
        city: place.name,
        country: place.country,
        tempC: cur.temperature_2m,
        feelsLikeC: cur.apparent_temperature,
        condition: CONDITIONS[cur.weather_code] ?? 'Unknown',
        windKph: cur.wind_speed_10m,
        humidityPct: cur.relative_humidity_2m,
      },
    });
  } catch {
    return c.json({ ok: false, error: 'Weather service unavailable' }, 502);
  }
});

export default weather;