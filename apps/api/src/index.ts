import { Hono } from 'hono';
import ping from './routes/ping';
import gold from './routes/gold';
import minecraft from './routes/minecraft';
import status from './routes/status';
import hackatime from './routes/hackatime';

const api = new Hono();

api.route('/ping', ping);
api.route('/gold', gold);
api.route('/minecraft', minecraft);
api.route('/status', status);
api.route('/hackatime', hackatime);

export default api;
