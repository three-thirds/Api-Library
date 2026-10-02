import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/auth';
import api from '../../api/src/index';

export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;

  // Existing API proxy
  if (event.url.pathname.startsWith('/api/v1/')) {
    if (!env) return new Response('Platform env unavailable', { status: 500 });

    const apiPath = event.url.pathname.slice('/api/v1'.length) || '/';

    const apiUrl = new URL(event.request.url);
    apiUrl.pathname = apiPath;

    return api.fetch(new Request(apiUrl, event.request), env);
  }

  // Better Auth (handles /api/auth/*, passes everything else to resolve)
  if (building || !env) return resolve(event);

  const auth = createAuth(env);

  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  return svelteKitHandler({ event, resolve, auth, building });
};