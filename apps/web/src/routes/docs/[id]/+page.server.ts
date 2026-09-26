import { ImageResponse} from '@vercel/og';
import apis from '$lib/apis.json';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async({ params}) => {
    const api = apis.find((api) => api.id === params.id);

    if (!api) {
        return new Response('Not Found', { status: 404});
    }

}