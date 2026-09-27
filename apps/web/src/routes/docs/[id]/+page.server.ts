import { error } from '@sveltejs/kit';
import apis from '$lib/apis.json';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params}) => {
    const api = apis.find((api) => api.id === params.id);
    if (!api) {
        throw error(404, 'API not found');
    }
    return { api };
}