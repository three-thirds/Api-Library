import { ApiClient } from "@threethirds/sdk";

const client = new ApiClient();

console.log(await client.get("gold"));
