import { Hono } from 'hono';
import ping from './routes/ping';
import silver from './routes/silver';
import oil from './routes/oil';
import gold from './routes/gold';
import platinum from './routes/platinum';
import copper from './routes/copper';

const api = new Hono();

api.route('/ping', ping);
api.route('/silver', silver);
api.route('/oil', oil);
api.route('/gold', gold);
api.route('/platinum', platinum);
api.route('/copper', copper);

export default api;
