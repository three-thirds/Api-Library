import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter({} as any, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
});

export const createAuth = (env: Env) =>
  betterAuth({
    database: drizzleAdapter(drizzle(env.threethirds_db, { schema }), {
      provider: "sqlite",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET || 'dev_secret_key_676767_sahurr',
    baseURL: env.BETTER_AUTH_URL || "https://localhost:5173/",
    emailAndPassword: { enabled: true },
  });
