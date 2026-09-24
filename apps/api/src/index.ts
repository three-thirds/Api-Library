import { Hono } from 'hono';
import ping from './routes/ping';
import minecraft from './routes/minecraft.ts';
import status from './routes/status.ts';
import hackatime from './routes/hackatime.ts';

const api = new Hono();

api.route('/ping', ping);
api.route('/minecraft', minecraft);
api.route('/status', status);
api.route('/hackatime', hackatime);

export default api;
