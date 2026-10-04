import { ApiClient } from "../packages/sdk/src/index.ts";

const client = new ApiClient({
    apiKey:"",
});

console.log(await client.get("auth-weather", { city: "Syndey"}));

// console.log(await client.get("gold"));