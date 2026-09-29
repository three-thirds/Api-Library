import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/auth';
import api from '../../api/src/index';

export const handle: Handle = async ({ event, resolve }) => {
  // Existing API proxy
  if (event.url.pathname.startsWith('/api/v1/')) {
    const apiPath = event.url.pathname.slice('/api/v1'.length) || '/';

    const apiUrl = new URL(event.request.url);
    apiUrl.pathname = apiPath;

    const apiRequest = new Request(apiUrl, event.request);

    return api.fetch(apiRequest, event.platform?.env);
  }

  // Better Auth (handles /api/auth/*, passes everything else to resolve)
  const auth = createAuth(event.platform!.env);
  return svelteKitHandler({ event, resolve, auth, building });
};