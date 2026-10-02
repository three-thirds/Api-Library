import { createMiddleware } from "hono/factory";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  capacity: number;
  refillRate: number;
}

export function rateLimiter(options: RateLimitOptions = { capacity: 30, refillRate: 1 }) {
  const buckets = new Map<string, Bucket>();

  return createMiddleware(async (c, next) => {
    const clientIp =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      '127.0.0.1';

    const now = performance.now();

    let bucket = buckets.get(clientIp);

    if (!bucket) {
      bucket = { tokens: options.capacity, lastRefill: options.refillRate };
      buckets.set(clientIp, bucket);
    } else {
      //Calculating how many tokens accumulated since last visit
      const elapsedSeconds = (now - bucket.lastRefill) / 1000;
      const tokensToAdd = elapsedSeconds * options.refillRate;

      bucket.tokens = Math.min(options.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;

      c.header('X-RateLimit-Limit', options.capacity.toString());
      c.header('X-RateLimit-Remaining', Math.floor(bucket.tokens).toString());

      await next();
    } else {
      const waitSeconds = Math.ceil((1 - bucket.tokens) / options.refillRate);

      c.header('Retry-After', waitSeconds.toString());
      c.header('X-RateLimit-Limit', options.capacity.toString());
      c.header('X-RateLimit-Remaining', '0');

      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry in ${waitSeconds} second(s).`,
        },
        429
      );
    }
  });

}
