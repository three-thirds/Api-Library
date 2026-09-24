import { Hono } from 'hono';
import ping from './routes/ping';
import weather from './routes/weather';

const api = new Hono();

api.route('/ping', ping);
api.route('/weather', weather)

export default api;