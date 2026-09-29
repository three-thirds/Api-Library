// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      context?: {
        waitUntil(promise: Promise<any>): void;
        passThroughOnException(): void;
      };
      caches?: CacheStorage;
      cf?: any;
      env: Env;
      ctx: ExecutionContext;
    }
  }
}

export { };
