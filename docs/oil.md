# Crude oil

Futures price for crude oil in dollars per barrel. If you do not name a benchmark you get WTI, the US one. Brent is the other one people mean, usually a bit higher. A barrel is 42 US gallons. An imperial gallon is bigger, so the UK gallon row is not 42 to the barrel.

/api/v1/oil

/api/v1/oil/wti forces WTI. /api/v1/oil/brent forces Brent. /api/v1/oil/usd follows the benchmark query and otherwise behaves like the plain path. /api/v1/oil/units lists barrel, US gallon, litre, and imperial gallon. /api/v1/oil/history is what this process has fetched, and you can limit it with benchmark.

- benchmark is wti or brent. The plain path defaults to wti
- unit is bbl, gal, l, or impgal. gallon means the US gallon
- amount is how many of that unit to price
- price stays dollars per barrel
- change, changePercent, dayHigh, and dayLow are from the futures session
- previousClose is the prior settle
- Cached for about a minute. stale means we kept the last good quote after a failed pull
- An unknown benchmark or unit is a 400
