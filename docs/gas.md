# Natural gas

Henry Hub natural gas futures, in dollars per million BTU. That is the number the market prints. Utility bills in the US often use therms, and a therm is a tenth of an MMBtu, so that conversion is here too.

/api/v1/gas

/api/v1/gas/usd is the same quote.

- price is dollars per MMBtu
- unit is mmbtu or therm. mmbtu is the default
- amount multiplies the unit you chose
- change, changePercent, dayHigh, and dayLow come from the session
- previousClose is the prior settle
- The quote is cached for about a minute
- An unknown unit is a 400
