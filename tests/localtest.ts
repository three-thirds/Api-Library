import { ApiClient } from "../packages/sdk/src/index.ts";

const client = new ApiClient();

console.log(await client.apiList());
