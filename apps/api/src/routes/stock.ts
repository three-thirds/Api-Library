import { Hono } from 'hono';
import { loadYahooQuote, quoteFields, upstreamError } from '../yahoo';

// A share ticker. US names are just the letters. NSE names keep the .NS
// the exchange already uses, so Reliance is RELIANCE.NS and the price
// comes back in rupees, not dollars.

const stock = new Hono();
const MAX_SHARES = 1_000_000;

function cleanSymbol(raw: string): string | null {
	const symbol = raw.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) return null;
	if (symbol.startsWith('.') || symbol.endsWith('.') || symbol.includes('..')) return null;
	return symbol;
}

function shareCount(raw: string | undefined): { ok: true; amount: number } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') return { ok: true, amount: 1 };

	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, error: 'amount has to be a positive number of shares' };
	}
	if (amount > MAX_SHARES) {
		return { ok: false, error: `amount is capped at ${MAX_SHARES}` };
	}
	return { ok: true, amount };
}

stock.get('/:symbol', async (c) => {
	const symbol = cleanSymbol(c.req.param('symbol'));
	if (!symbol) {
		return c.json(
			{
				ok: false,
				error: 'symbol looks wrong. use something like AAPL or RELIANCE.NS'
			},
			400
		);
	}

	const shares = shareCount(c.req.query('amount'));
	if (!shares.ok) {
		return c.json({ ok: false, error: shares.error }, 400);
	}

	try {
		const quote = await loadYahooQuote(symbol);
		return c.json({
			ok: true,
			kind: 'stock',
			...quoteFields(quote, shares.amount)
		});
	} catch (err) {
		return c.json(upstreamError(err, 'could not load that stock'), 502);
	}
});

export default stock;
