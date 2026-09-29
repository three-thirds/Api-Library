import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

export const auth = betterAuth({
  database: drizzleAdapter({} as any, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
});

export const createAuth = (env: Env) =>
  betterAuth({
    database: drizzleAdapter(drizzle(env.threethirds_db), { provider: "sqlite" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
  });