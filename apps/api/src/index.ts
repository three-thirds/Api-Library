import { Hono } from 'hono';
import ping from './routes/ping';
import weather from './routes/weather';
import issLocation from './routes/iss-location';
import wikipedia from './routes/wikipedia';

const api = new Hono();

api.route('/ping', ping);
api.route('/weather', weather)
api.route('/iss-location', issLocation);
api.route('/wikipedia', wikipedia);

export default api;