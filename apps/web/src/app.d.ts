// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env?: {
        VAULT_KV?: any;
        ASSETS?: any;
        [key: string]: any;
      };
      context?: {
        waitUntil(promise: Promise<any>): void;
        passThroughOnException(): void;
      };
      caches?: CacheStorage;
      cf?: any;
    }
  }
}

export { };
