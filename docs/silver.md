# Silver

Spot price of silver in US dollars for one troy ounce. The conversions are the same idea as gold: grams, 10 grams, tola, and kilograms, all from that troy ounce rather than a grocery ounce.

/api/v1/silver

/api/v1/silver/usd is the same quote. /api/v1/silver/units is the price in each unit. /api/v1/silver/history is the fresh pulls this process has kept, and it is empty again after a restart.

- Default unit is oz
- unit accepts oz, g, 10g, tola, and kg
- amount multiplies the chosen unit. One is assumed when you leave it off
- price is always dollars per troy ounce
- totalUsd is pricePerUnit times amount
- The quote is cached for about a minute
- If the feed is down and we still have a quote, stale is true
- An unknown unit comes back as 400
