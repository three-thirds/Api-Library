# Split

You post a bill total and who is paying. The route splits it by share and shows each person what they owe in the request currency plus the other one through today's rupee rate.

POST /api/v1/split with a JSON body. GET /api/v1/split shows the body shape.

```json
{
  "total": 3000,
  "currency": "INR",
  "people": [
    { "name": "a", "share": 0.5 },
    { "name": "b", "share": 0.3 },
    { "name": "c", "share": "equal" }
  ]
}
```

- total is required and has to be greater than zero
- currency is INR or USD. Leave it off and the bill is in rupees
- people is required, 1 to 20. Same name twice gets merged
- share is a fraction from 0 to 1, or the string equal
- fixed shares have to add up to 1 when nobody is equal. If some are equal, the leftover after the fixed shares is split evenly among them
- each person gets owes in the request currency, plus owesInr and owesUsd
- winner is who pays the most. verdict is one sentence from that
- empty people, shares that do not cover the bill, or a junk body is a 400
- if the rupee rate is missing the route answers 502
