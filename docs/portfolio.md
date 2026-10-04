# Portfolio

You post what you hold. The route marks each line to today's spot, converts into INR or USD, and tells you which holding is most of the pile.

POST /api/v1/portfolio with a JSON body. GET /api/v1/portfolio lists the aliases and the body shape.

```json
{
  "currency": "INR",
  "holdings": [
    { "id": "gold", "amount": 2 },
    { "id": "btc", "amount": 0.1 },
    { "id": "AAPL", "amount": 10 },
    { "id": "RELIANCE.NS", "amount": 5 },
    { "id": "cash", "amount": 50000 }
  ]
}
```

- currency is INR or USD. Leave it off and totals are in rupees. cash is already in that currency
- holdings is required, 1 to 20 rows. Same id twice gets merged into one line
- each row needs id and a positive amount
- aliases: gold, silver, platinum, copper, oil, gas, btc, eth, sp500, nasdaq, nifty, sensex, cash
- gold, silver, and platinum amounts are troy ounces. copper is pounds
- anything else is a stock ticker, same rules as /stock. RELIANCE.NS stays in rupees
- each priced row has price, quoteCurrency, value in the request currency, and weight
- winner and loser are by weight. cash is allowed to win
- verdict is one sentence from those weights
- a quote that fails, or a currency we do not convert, lands in skipped
- empty holdings, bad currency, or a junk body is a 400
- if the rupee rate is missing when we need it, or every non-cash line fails, the route answers 502
- spots refresh about once a minute. the whole answer is cached for a minute too
