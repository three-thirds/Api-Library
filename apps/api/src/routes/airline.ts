import {Hono} from 'hono';
import { type AuthEnv, requiresApiKey } from "../middleware/auth";


const app = new Hono<AuthEnv>();
app.use('*', requiresApiKey);

app.get('/flights/:flightNumber', async (c) => {
    const vault = c.get('vault');
    const apiKey = vault.secrets['aviationstack'];

    if (!apiKey) {
        return c.json({
            error: 'Missing upstream Credentials',
            message: 'No Aviationstack key found in vault.'
        }, 400);
    }
})

export default app;