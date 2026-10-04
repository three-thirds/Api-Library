import {Hono} from 'hono';
import { type AuthEnv, requiresApiKey } from "../middleware/auth";


const app = new Hono<AuthEnv>();
app.use('*', requiresApiKey);

app.get('/flights/:flightNumber', async (c) => {

})

export default app;