import { Hono } from 'hono';
import type { Context } from 'hono';
import { loadYahooQuote, roundTo, upstreamError } from '../yahoo';

// Henry Hub natural gas futures. The quote is dollars per MMBtu.
// A therm is a tenth of that, which is the unit on a lot of utility bills.

const YAHOO_SYMBOL = 'NG=F';
const MAX_AMOUNT = 1_000_000;

type UnitName = 'mmbtu' | 'therm';

const gas = new Hono();

function unitFromQuery(raw: string | undefined): UnitName | null {
	if (raw == null || raw.trim() === '') return 'mmbtu';

	switch (raw.trim().toLowerCase()) {
		case 'mmbtu':
		case 'mbtu':
			return 'mmbtu';
		case 'therm':
		case 'therms':
			return 'therm';
		default:
			return null;
	}
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

function perUnit(pricePerMmbtu: number, unit: UnitName): number {
	if (unit === 'therm') return pricePerMmbtu / 10;
	return pricePerMmbtu;
}

async function handleQuote(c: Context) {
	const unit = unitFromQuery(c.req.query('unit'));
	if (!unit) {
		return c.json({ ok: false, error: 'unknown unit', supported: ['mmbtu', 'therm'] }, 400);
	}

	const amount = amountFromQuery(c.req.query('amount'));
	if (!amount.ok) {
		return c.json({ ok: false, error: amount.error }, 400);
	}

	try {
		const quote = await loadYahooQuote(YAHOO_SYMBOL);
		const pricePerUnit = perUnit(quote.price, unit);

		return c.json({
			ok: true,
			commodity: 'natural gas',
			symbol: quote.symbol,
			name: quote.name,
			currency: quote.currency,
			price: quote.price,
			unit,
			unitLabel: unit === 'therm' ? 'therm' : 'million BTU',
			amount: amount.amount,
			pricePerUnit: roundTo(pricePerUnit, 4),
			total: roundTo(pricePerUnit * amount.amount, 4),
			previousClose: quote.previousClose,
			change: quote.change == null ? null : roundTo(quote.change, 4),
			changePercent: quote.changePercent == null ? null : roundTo(quote.changePercent, 4),
			dayHigh: quote.dayHigh,
			dayLow: quote.dayLow,
			updatedAt: quote.updatedAt,
			cached: quote.fromCache,
			stale: quote.stale,
			ageMs: Date.now() - quote.fetchedAt
		});
	} catch (err) {
		return c.json(upstreamError(err, 'could not load the natural gas price'), 502);
	}
}

gas.get('/', handleQuote);
gas.get('/usd', handleQuote);

export default gas;
