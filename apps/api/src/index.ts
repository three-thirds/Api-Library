import { Hono } from 'hono';
import ping from './routes/ping';
import silver from './routes/silver';
import oil from './routes/oil';

const api = new Hono();

api.route('/ping', ping);
api.route('/silver', silver);
api.route('/oil', oil);

export default api;
