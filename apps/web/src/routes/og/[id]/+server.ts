import {ImageResponse} from "workers-og";
import apis from "$lib/apis.json";
import type { RequestHandler} from "./$types";

export const GET: RequestHandler = async({ params}) => {
    const api = apis.find((api) => api.id === params.id);

    if (!api) {
        return new Response('Not Found', { status: 404});
    }

    const html = `

     ${api.name}
     `;

     return new ImageResponse(html, {
        width: 1200,
        height: 630,
    });
}

