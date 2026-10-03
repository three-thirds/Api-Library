# Ladder

You post a date, a pile of cash, and a weighted mix of buys. The route pretends you split the pile that way at that day's close, marks each slice to today, and tells you which rung won.

POST /api/v1/ladder with a JSON body. GET /api/v1/ladder lists the assets and the body shape.

```json
{
  "date": "2020-03-23",
  "amount": 100000,
  "currency": "INR",
  "buys": [
    { "id": "btc", "weight": 0.4 },
    { "id": "gold", "weight": 0.3 },
    { "id": "nifty", "weight": 0.3 }
  ]
}
```

- date is required and looks like 2020-03-23. A weekend or holiday walks forward to the next session, up to a week
- amount is how much cash you pretend you had
- currency is INR or USD. Leave it off and the pile is rupees
- buys is required, 1 to 6 rows. Same id twice merges weights
- each buy needs id and a positive weight. Weights have to add up to 1
- ids are the same as regret: gold, btc, oil, nifty, reliance, sp500
- each asset row has weight, slice, priceThen, priceNow, valueNow, profit, and multiple
- cash you never invested is always in the list with multiple 1
- winner and loser are by multiple. cash is allowed to win
- verdict is one sentence from those numbers
- a junk date, future date, unknown id, or weights that do not sum to 1 is a 400
- if the rupee rate is missing, or every buy misses, the route answers 502
