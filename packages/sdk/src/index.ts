export function test() {
  return `If you are reading this, the package is working as intended.`;
}

export async function apiList() {
  const response = await fetch("https://api.threethirds.dev/api/v1/apis");

  const apis = await response.json();
  return apis
}

export class ApiClient {
  private apiKey?: string;
  private baseUrl: string;

  private apis: any[] | null = null;

  constructor(
    options: {
      apiKey?: string;
      baseUrl?: string;
    } = {}
  ) {
    this.baseUrl = options.baseUrl ?? "https://api.threethirds.dev/api/v1";
    this.apiKey = options.apiKey
  }

  private async getApis(): Promise<any[]> {
    if (this.apis) {
      return this.apis;
    }

    const response = await fetch(`${this.baseUrl}/apis`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch API list: ${response.status} ${response.statusText}`
      );
    }

    const apis = await response.json();

    this.apis = apis;

    return apis;
  }

  async get(
    id: string,
    params: Record<string, any> = {}
  ) {
    const apis = await this.getApis();

    const api = apis.find(
      (api: any) => api.id === id
    );

    if (!api) {
      throw new Error(
        `API with id "${id}" not found`
      );
    }

    // Don't modify the user's original object
    const requestParams = { ...params };

    let route = api.route.replace(/^\/api\/v1/, "");

    // Replace path parameters
    route = route.replace(
      /:([a-zA-Z0-9_-]+)/g,
      (_: string, name: string) => {
        const value = requestParams[name];

        if (value === undefined) {
          throw new Error(
            `Missing parameter: ${name}`
          );
        }

        delete requestParams[name];

        return encodeURIComponent(String(value));
      }
    );

    const url = new URL(
      `${this.baseUrl}${route}`
    );

    const method = api.method.toUpperCase();

    let body: string | undefined;

    if (method === "GET") {
      for (const [key, value] of Object.entries(requestParams)) {
        url.searchParams.set(key, String(value));
      }
    } else {
      body = JSON.stringify(requestParams);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (api.auth) {
      if (!this.apiKey) {
        throw new Error(
          `API "${id}" requires authentication, but no API key was provided`
        );
      }

      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to call API "${id}": ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }
}