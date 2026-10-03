export function test() {
  return `If you are reading this, the package is working as intended.`;
}

export async function gold() {
  const response = await fetch("https://api.threethirds.dev/api/v1/gold");

  if(!response.ok) {
    throw new Error(`Failed to fetch gold price: ${response.status} ${response.statusText}`);
  }

  return response.json();
}