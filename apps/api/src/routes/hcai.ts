import { Hono} from "hono";
import { type AuthEnv, requiresApiKey } from "../middleware/auth";


const app = new Hono<AuthEnv>();
app.use('*', requiresApiKey);


app.post('/hcai', async (c) => {
    const vault = c.get('vault');
    const apiKey = vault.secrets['hackclub-ai'];

    if (!apiKey) {
        return c.json({
            error: 'Missing upstream Credentials',
            message: 'No Hackclub AI key found in vault.'
        }, 400);
    }

    try {
        const body = await c.req.json();
        const res = await fetch(
            "https://ai.hackclub.com/proxy/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(30_000),
            }
        )

        if (!res.ok) {
            return c.json(
                {   
                    error: `Hackclub AI returned HTTP: ${res.status}`,
                    details: await res.text()
                },
                502,
            )
        }

        const data = await res.json();
        return c.json(data);
    } catch (err) {
        return c.json({
            error: 'Failed to proxy Hackclub AI request',
            details: String(err)
        }, 500)
    }
});

export default app;