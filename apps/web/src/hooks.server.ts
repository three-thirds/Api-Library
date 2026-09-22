import type { Handle } from '@sveltejs/kit';
import api from '../../api/src/index';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/v1/')) {
		const apiPath = event.url.pathname.slice('/api/v1'.length) || '/';

		const apiUrl = new URL(event.request.url);
		apiUrl.pathname = apiPath;

		const apiRequest = new Request(apiUrl, event.request);

		return api.fetch(apiRequest);
	}

	return resolve(event);
};