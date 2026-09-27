# Gold

Spot price of gold in US dollars. The headline number is one troy ounce. A troy ounce is heavier than the ounce on a kitchen scale, about 31.1 grams, so the gram and kilogram rows use that weight and not 28.35.

/api/v1/gold

/api/v1/gold/usd is the same quote. /api/v1/gold/units lists every unit against the current ounce price. /api/v1/gold/history is only the pulls this process has made since it started, oldest first, and it disappears on restart.

- Leave the query empty and you get one troy ounce
- unit can be oz, g, 10g, tola, or kg. ounce, gram, and tola spellings work too
- amount is how many of that unit you want priced. It has to be greater than zero
- price stays the dollar price of one troy ounce even when you ask for grams
- pricePerUnit and totalUsd follow the unit and amount you sent
- conversions repeats the price in every unit
- cached means we reused a quote from the last minute
- stale means the live pull failed and you are seeing the last good number
- A unit we do not know is a 400, with the names we do accept
