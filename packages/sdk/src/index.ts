const response = await fetch("https://api.threethirds.dev/api/v1/apis");

const apis = await response.json();

export function test() {
  return `If you are reading this, the package is working as intended.`;
}

export function apiList() {
  return apis
}

export async function gold() {
  const response = await fetch("https://api.threethirds.dev/api/v1/gold");

  if(!response.ok) {
    throw new Error(`Failed to fetch gold price: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl = 'https://api.threethirds.dev/api/v1') {
        this.baseUrl = baseUrl;
    }

    private async get(path: string) {
        const response = await fetch(`${this.baseUrl}${path}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    gold = () => this.get('/gold');
    apiList = () => this.get('/apiList');
}

export { ApiClient };