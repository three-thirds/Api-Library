import { Hono } from 'hono';
import ping from './routes/ping';
import silver from './routes/silver';
import oil from './routes/oil';
import gold from './routes/gold';
import platinum from './routes/platinum';
import copper from './routes/copper';
import gas from './routes/gas';
import stock from './routes/stock';
import indices from './routes/indices';
import fx from './routes/fx';
import crypto from './routes/crypto';
import minecraft from './routes/minecraft';
import status from './routes/status';
import hackatime from './routes/hackatime';

const api = new Hono();

api.route('/ping', ping);
api.route('/silver', silver);
api.route('/oil', oil);
api.route('/gold', gold);
api.route('/platinum', platinum);
api.route('/copper', copper);
api.route('/gas', gas);
api.route('/stock', stock);
api.route('/index', indices);
api.route('/fx', fx);
api.route('/crypto', crypto);
api.route('/minecraft', minecraft);
api.route('/status', status);
api.route('/hackatime', hackatime);

export default api;
