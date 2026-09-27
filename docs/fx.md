# Exchange rate

How much of one currency you get for another. The price is quote currency for one unit of the base. USDINR is rupees for one US dollar. EURUSD is dollars for one euro. A pair that starts with USD is looked up as "that currency per dollar". Anything else, like EURUSD or GBPUSD, is looked up as the six letter pair.

/api/v1/fx lists a few common paths.

/api/v1/fx/USDINR

/api/v1/fx/EURUSD

- The pair goes in the path. A slash is fine, so USD/INR works too
- INR and JPY on their own mean the dollar rate
- EUR and GBP on their own mean the dollar price of one euro or one pound
- Any other 6 letter pair is accepted the same way
- amount is how many units of the base currency to convert. It defaults to 1
- total is price times amount
- change and changePercent are the move on the session
- A pair that is not 3 or 6 letters is a 400
- Rates are cached for about a minute
