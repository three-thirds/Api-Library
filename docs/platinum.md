# Platinum

Spot price of platinum in US dollars for one troy ounce. Treat the ounce the same way you treat gold. It is 31.1 grams, not the lighter kitchen ounce.

/api/v1/platinum

/api/v1/platinum/usd is the same handler.

- price is dollars for one troy ounce
- unit can be oz, g, 10g, tola, or kg
- amount is how many of those units to price
- pricePerUnit and totalUsd follow unit and amount
- conversions shows the other units beside the one you asked for
- A quote is reused for about a minute, and cached is true when that happens
- If a later pull fails, the last good price is returned with stale set
- Unknown units are a 400
