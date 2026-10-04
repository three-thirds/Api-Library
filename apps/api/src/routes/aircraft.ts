import {Hono} from 'hono';
import { type AuthEnv, requiresApiKey } from "../middleware/auth";

const app = new Hono<AuthEnv>();
app.use('*', requiresApiKey);

app.get('/aircraft/:aircraft', async(c) => {
    const vault = c.get("vault");
    const apiKey = vault.secrets["aviationstack"];

    if (!apiKey) {
        return c.json({
            error: "Missing upstream Credentials",
            message: "No Aviationstack key found in vault."
        }, 400)
    }

    const aircraft = c.req.param("aircraft");

    try {
        const res = await fetch(
            "https://api.aviationstack.com/v1/aircrafts?access_key=" + encodeURIComponent(apiKey) + "&search=" + encodeURIComponent(aircraft),
            {
                method: "GET",
                signal: AbortSignal.timeout(5000)
            }
        )
        
        if (!res.ok) {
            return c.json(
                {
                    error: `Aviationstack returned HTTP: ${res.status}`
                }, 502
            )
        }

        const data = await res.json();

        return c.json(data);
    } catch (err) {
        return c.json({
            error: "Failed to proxy Aviationstack request",
            details: String(err)
        }, 500)
    }
})