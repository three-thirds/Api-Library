# Market index

The level of a whole market, not one company. These are index points. Nifty and Sensex are quoted in rupees in the sense that the exchange is Indian, but the number itself is the index level, not the price of a share.

/api/v1/index lists the four names without fetching prices.

- /api/v1/index/sp500 is the S&P 500
- /api/v1/index/nasdaq is the Nasdaq Composite
- /api/v1/index/nifty is the Nifty 50
- /api/v1/index/sensex is the BSE Sensex

Each of those returns the last level plus the session move.

- price is the index level
- previousClose, change, and changePercent describe the move from the prior close
- dayHigh and dayLow are this session
- An unknown name is a 400 and the body lists the four that work
- Quotes are cached for about a minute
