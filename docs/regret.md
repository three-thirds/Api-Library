# Regret

You name a day and a pile of cash. The route pretends you bought each asset at that day's close, marks it to today's price, and tells you which choice is going to bother you.

/api/v1/regret?date=2020-03-23&amount=100000&currency=INR

The default basket is gold, bitcoin, WTI crude, the Nifty 50, Reliance, and the S&P 500. Cash you never invested is in the list too, so the assets have something dull to beat. The other currency is in there as well. If the rupee moved, holding dollars shows up on its own.

- date is required and looks like 2020-03-23. A weekend or holiday walks forward to the next session, up to a week
- usedDate is the rupee session we actually used for the conversion
- each asset also has its own usedDate, because NSE and New York do not share holidays
- amount is how much cash you pretend you had. It has to be greater than zero
- currency is INR or USD. Leave it off and the pile is rupees
- only is a comma list when you do not want the whole basket. The names are gold, btc, oil, nifty, reliance, sp500
- INR into a dollar asset goes through that day's rupee rate, then back through today's rate. Reliance and the Nifty are already in rupees, so they skip that
- each row has priceThen, priceNow, valueNow, profit, and multiple
- winner and loser are the best and worst rows, and cash is allowed to win
- verdict is one sentence from those numbers
- a junk date, a future date, or an unknown name in only is a 400
- if the rupee rate is missing, or every asset misses, the route answers 502
- old closes are kept for a day. today's prices refresh about once a minute
