import { createOgImageHandler } from '$lib/og-image';
import type { RequestHandler } from './$types';
import apis from '$lib/apis.json';
 
// This is optional, use it if you want to generate OG image at build time.
// export const prerender = true;
 
export function entries() {
    return apis.map((api) => ({ id: api.id }));
}

export const GET: RequestHandler = async (event) => {
	const api = apis.find((api) => api.id === 	event.params.id);
	if (!api) {
		return new Response('Not found', { status: 404 });
	}
	return createOgImageHandler({ api })(event);
};