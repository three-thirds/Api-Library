const API_LIST_URL = "https://api.threethirds.dev/api/v1/apis";

const response = await fetch(API_LIST_URL);

if (!response.ok) {
  throw new Error(`Failed to fetch API list: ${response.status} ${response.statusText}`);
}

const apis = await response.json();

console.log(`Found ${apis.length} APIS:`);

for (const api of apis) {
    console.log(` ${api.id}:${api.method} ${api.route}`);
}

export {}

