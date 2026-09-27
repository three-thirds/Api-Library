# Copper

Copper is quoted in dollars per pound, not per troy ounce. The pound is the everyday 453.6 gram pound. The ounce on this route is one sixteenth of that pound. Do not reuse the gold ounce here or the price will look slightly off and actually be wrong.

/api/v1/copper

/api/v1/copper/usd is the same quote.

- price is dollars for one pound
- unit can be lb, oz, kg, or t. t means a metric tonne
- amount defaults to 1
- pricePerUnit and totalUsd follow the unit you picked
- conversions lists pound, ounce, kilogram, and tonne
- Cached quotes last about a minute
- stale means the feed missed and this is the previous good price
- An unknown unit is a 400
