import { describe, expect, it } from "bun:test";
import keysApp from './keys';

describe('Testing key.ts', () => {
  let createdMasterKey = '';
  let userId = '';

  it('POST /create generates a new key and initiates empty vault', async () => {
    const res = await keysApp.request('/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Chish Dev Laptop' })
    });

    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.master_key).toBeDefined();
    expect(json.master_key.startsWith('al_live')).toBe(true);
    expect(json.name).toBe('Chish Dev Laptop');
    expect(json.user_id).toBeDefined();

    createdMasterKey = json.master_key;
    userId = json.user_id;
  });

  it('POST /secrets rejects unautheticated request with 401', async () => {
    const res = await keysApp.request('/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openweather', secret: 'secret_123' }),
    });

    expect(res.status).toBe(401);
  });

  it('POST /secrets rejects incomplete payload with 400', async () => {
    const res = await keysApp.request('/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createdMasterKey}`, },
      body: JSON.stringify({ provider: 'openweather' }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /secrets rejects incomplete payload with 400', async () => {
    const res = await keysApp.request('/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createdMasterKey}`, },
      body: JSON.stringify({ provider: 'openweather' }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /secrets saves a valid secret', async () => {
    const res = await keysApp.request('/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createdMasterKey}`, },
      body: JSON.stringify({
        provider: 'openweather',
        secret: 'live_weather_token_6769'
      }),
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.provider).toBe('openweather');
  });

  it('GET /secrets lists configured secrets without exposing real keys', async () => {
    const res = await keysApp.request('/secrets', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${createdMasterKey}`
      },
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.user_id).toBe(userId);
    expect(json.configured_secrets).toBeDefined();

    const masked = json.configured_secrets['openweather'];
    expect(masked).toBe('live...6769');
    expect(masked).not.toBe('live_weather_token_6769');

  });
});
