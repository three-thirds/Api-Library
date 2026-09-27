import { Hono } from 'hono';
import { loadYahooQuote, quoteFields, upstreamError } from '../yahoo';

// Yahoo writes "rupees per dollar" as INR=X, and "dollars per euro" as
// EURUSD=X. Callers can pass the pair the normal way (USDINR, EURUSD)
// and we pick the symbol that actually exists.

const MAX_AMOUNT = 1_000_000_000;

type Pair = {
	yahoo: string;
	base: string;
	quote: string;
};

const fx = new Hono();

function resolvePair(raw: string): Pair | null {
	const pair = raw.trim().toUpperCase().replace('/', '').replace('-', '');
	if (!pair) return null;

	if (pair === 'INR' || pair === 'USDINR') {
		return { yahoo: 'INR=X', base: 'USD', quote: 'INR' };
	}
	if (pair === 'JPY' || pair === 'USDJPY') {
		return { yahoo: 'JPY=X', base: 'USD', quote: 'JPY' };
	}
	if (pair === 'EUR' || pair === 'EURUSD') {
		return { yahoo: 'EURUSD=X', base: 'EUR', quote: 'USD' };
	}
	if (pair === 'GBP' || pair === 'GBPUSD') {
		return { yahoo: 'GBPUSD=X', base: 'GBP', quote: 'USD' };
	}

	if (/^[A-Z]{3}=X$/.test(pair)) {
		return { yahoo: pair, base: 'USD', quote: pair.slice(0, 3) };
	}

	if (/^[A-Z]{6}=X$/.test(pair)) {
		return { yahoo: pair, base: pair.slice(0, 3), quote: pair.slice(3, 6) };
	}

	if (/^[A-Z]{6}$/.test(pair)) {
		const base = pair.slice(0, 3);
		const quote = pair.slice(3);
		// dollars into something else is the XXX=X symbol, not USDXXX=X
		if (base === 'USD') return { yahoo: `${quote}=X`, base, quote };
		return { yahoo: `${pair}=X`, base, quote };
	}

	return null;
}

function amountFromQuery(raw: string | undefined): { ok: true; amount: number } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') return { ok: true, amount: 1 };

	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, error: 'amount has to be a positive number' };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `amount is capped at ${MAX_AMOUNT}` };
	}
	return { ok: true, amount };
}

fx.get('/', (c) => {
	return c.json({
		ok: true,
		note: 'price is how much quote currency you get for one unit of base',
		examples: [
			{ pair: 'USDINR', path: '/api/v1/fx/USDINR' },
			{ pair: 'EURUSD', path: '/api/v1/fx/EURUSD' },
			{ pair: 'GBPUSD', path: '/api/v1/fx/GBPUSD' },
			{ pair: 'USDJPY', path: '/api/v1/fx/USDJPY' }
		]
	});
});

fx.get('/:pair', async (c) => {
	const pair = resolvePair(c.req.param('pair'));
	if (!pair) {
		return c.json(
			{
				ok: false,
				error: 'pair looks wrong. use USDINR, EURUSD, or a 6 letter pair'
			},
			400
		);
	}

	const amount = amountFromQuery(c.req.query('amount'));
	if (!amount.ok) {
		return c.json({ ok: false, error: amount.error }, 400);
	}

	try {
		const quote = await loadYahooQuote(pair.yahoo);
		return c.json({
			ok: true,
			kind: 'fx',
			pair: `${pair.base}${pair.quote}`,
			base: pair.base,
			quote: pair.quote,
			...quoteFields(quote, amount.amount)
		});
	} catch (err) {
		return c.json(upstreamError(err, 'could not load that rate'), 502);
	}
});

export default fx;
