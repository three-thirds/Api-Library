import { createAuth } from "$lib/auth";
import type { RequestHandler } from "@sveltejs/kit";

const handleAuth: RequestHandler = async (event) => {
  const env = event.platform?.env;
  if (!env) {
    return new Response('Platform Environment unavailable', { status: 500 });
  }
  const auth = createAuth(env as any);
  return auth.handler(event.request);
}

export const GET = handleAuth;
export const POST = handleAuth;
export const fallback = handleAuth;

