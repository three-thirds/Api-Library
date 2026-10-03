import { Hono } from 'hono';

import apis from "../../../web/src/lib/apis.json"

const apilist = new Hono();

apilist.get('/', (c) => {
	return c.json(apis);
});

export default apilist;