import { Hono } from 'hono';
import ping from './routes/ping';

const api = new Hono();

api.route('/ping', ping);

export default api;