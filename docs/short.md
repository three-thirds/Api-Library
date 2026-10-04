# Short

Paste a long http(s) url. The route stores it in Cloudflare KV and hands back a short code. Resolve it as JSON, or hit /go to redirect.

POST /api/v1/short with a JSON body. GET /api/v1/short shows the shape.

```json
{
  "url": "https://example.com/some/long/path",
  "code": "lunch",
  "ttlDays": 30
}
```

- url is required and has to be http or https. javascript and data urls are rejected
- code is optional. 3 to 32 letters, numbers, _ or -. Leave it off and we mint a random 7 char one
- ttlDays is optional, 1 to 365. Leave it off and the link does not expire
- posting the same url again returns the existing code
- GET /api/v1/short/{code} returns the url and a hit count
- GET /api/v1/short/{code}/go redirects with 302
- a taken custom code is a 409
- a junk url or bad code is a 400
- an unknown code is a 404
- rows live under short: keys in VAULT_KV next to the vault, not on top of it
