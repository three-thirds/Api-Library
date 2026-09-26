import { Hono } from 'hono';
import ping from './routes/ping';
import silver from './routes/silver';
import oil from './routes/oil';
import gold from './routes/gold';

const api = new Hono();

api.route('/ping', ping);
api.route('/silver', silver);
api.route('/oil', oil);
api.route('/gold', gold);

export default api;
