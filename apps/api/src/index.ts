import { Hono } from 'hono';
import ping from './routes/ping';
import silver from './routes/silver';

const api = new Hono();

api.route('/ping', ping);
api.route('/silver', silver);

export default api;
