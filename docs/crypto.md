# Crypto

Dollar price of bitcoin or ethereum. This is the coin in USD, not a gram conversion and not a stock ticker.

/api/v1/crypto lists the two coins.

- /api/v1/crypto/btc is bitcoin. bitcoin and BTC-USD in the path work too
- /api/v1/crypto/eth is ethereum. ethereum and ETH-USD work too

- price is dollars for one coin
- amount is how many coins to price, and fractions are fine
- total is price times amount
- previousClose, change, changePercent, dayHigh, and dayLow are from the session
- Anything other than bitcoin or ethereum is a 400
- A quote is reused for about a minute
