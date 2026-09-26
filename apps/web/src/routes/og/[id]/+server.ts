import { ImageResponse } from "@vercel/og";
import apis from '$lib/apis.json';
import type { RequestHandler} from './$types';

export const config = {
  runtime: 'edge',
};

export const GET: RequestHandler = async ({ params }) => {
    const api = apis.find((api) => api.id === params.id);
    if (!api) {
        return new Response('API not found', { status: 404 });
    }
    
    return new ImageResponse(
        {
            type: 'div',
            props: {
                children: api.name
            }
        } as any,
        {
            width: 1200,
            height: 630
        }
    );
};