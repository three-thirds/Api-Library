# Stock

Last traded price for a single share. US tickers are the letters on their own, like AAPL or MSFT. Stocks on the NSE need the .NS suffix the exchange already uses, so Reliance is RELIANCE.NS and TCS is TCS.NS. The currency in the body is the currency of that listing. Apple comes back in dollars. Reliance comes back in rupees.

/api/v1/stock/AAPL

/api/v1/stock/RELIANCE.NS

- The ticker goes in the path
- amount is how many shares to extend the price across. It defaults to 1
- price is the last trade
- total is price times amount
- previousClose is the prior session
- change and changePercent are against that close
- dayHigh and dayLow are this session
- exchange is the venue name when the feed sends one
- A symbol with spaces, slashes, or a caret is a 400. Indices belong on the index route
- If the feed has never heard of that ticker, the route answers 502
- A good quote is reused for about a minute
