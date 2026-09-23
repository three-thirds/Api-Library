import { Hono } from 'hono';
import ping from './routes/ping';
import minecraft from './routes/minecraft.ts';
import status from './routes/status.ts';

const api = new Hono();

api.route('/ping', ping);
api.route('/minecraft', minecraft);
api.route('/status', status);

export default api;
