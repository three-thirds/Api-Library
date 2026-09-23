import { Hono } from 'hono';
import ping from './routes/ping';
import minecraft from './routes/minecraft.ts';

const api = new Hono();

api.route('/ping', ping);
api.route('/minecraft', minecraft);

export default api;
