import { Hono } from 'hono';
import ping from './routes/ping';
import gold from './routes/gold';

const api = new Hono();

api.route('/ping', ping);
api.route('/gold', gold);

export default api;