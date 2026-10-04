# Invoice

You post a messy bill. Aliases and tickers get marked to today's spot. Plain cash lines stay cash. The route totals it in INR or USD and says what most of the invoice is.

POST /api/v1/invoice with a JSON body. GET /api/v1/invoice lists the aliases and the body shape.

```json
{
  "currency": "INR",
  "lines": [
    { "id": "gold", "amount": 1 },
    { "id": "oil", "amount": 10 },
    { "id": "AAPL", "amount": 2 },
    { "label": "snacks", "cash": 500 }
  ]
}
```

- currency is INR or USD. Leave it off and totals are in rupees
- lines is required, 1 to 20
- an id line is an alias or stock ticker with amount, same rules as /portfolio
- a label+cash line is plain money already in the request currency
- gold, silver, and platinum amounts are troy ounces. copper is pounds
- each priced line has value and weight. total is the sum
- verdict is one short sentence about the biggest line
- a quote that fails lands in skipped
- empty lines or a junk body is a 400
- if every priced alias/ticker fails, or the rupee rate is missing when needed, the route answers 502
