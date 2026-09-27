import { ImageResponse } from '@ethercorps/sveltekit-og';
import SimpleCard from '$lib/components/testog.svelte';
import type { RequestHandler } from '@sveltejs/kit';
import apis from '$lib/apis.json';
 
// This is optional, use it if you want to generate OG image at build time.
export const prerender = true;
 
export function entries() {
    return apis.map((api) => ({ id: api.id }));
}

export const GET: RequestHandler = async () => {
	return new ImageResponse(
		SimpleCard, // ⬅️ Pass the Svelte component here
		{
			width: 1200,
			height: 630,
            props : {api}
		}
	);
};