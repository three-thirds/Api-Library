import { Hono } from 'hono';
import { loadDailyClose, loadYahooQuote, roundTo, upstreamError } from '../yahoo';

// one pile of cash, one old date, and the basket we always argue about.
// gold and bitcoin are the loud ones. nifty and reliance are in here
// because "what if i'd just bought the index" is the other half of that argument.

const ASSETS = [
	{ id: 'gold', name: 'Gold', yahoo: 'GC=F' },
	{ id: 'btc', name: 'Bitcoin', yahoo: 'BTC-USD' },
	{ id: 'oil', name: 'WTI crude', yahoo: 'CL=F' },
	{ id: 'nifty', name: 'Nifty 50', yahoo: '^NSEI' },
	{ id: 'reliance', name: 'Reliance', yahoo: 'RELIANCE.NS' },
	{ id: 'sp500', name: 'S&P 500', yahoo: '^GSPC' }
] as const;

type Asset = (typeof ASSETS)[number];

const FX = 'INR=X';
const MAX_AMOUNT = 1_000_000_000_000;
const RESULT_CACHE_MS = 60 * 1000;

type Money = 'INR' | 'USD';

type Row = {
	id: string;
	name: string;
	symbol: string | null;
	usedDate: string | null;
	priceThen: number | null;
	priceNow: number | null;
	valueNow: number;
	profit: number;
	multiple: number;
};

type Skip = {
	id: string;
	reason: string;
};

const regret = new Hono();
const remembered = new Map<string, { body: unknown; goodUntil: number }>();

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function readDate(raw: string | undefined): { ok: true; date: string } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') {
		return { ok: false, error: 'date is required, like 2020-03-23' };
	}

	const date = raw.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return { ok: false, error: 'date has to look like 2020-03-23' };
	}

	const [year, month, day] = date.split('-').map(Number);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	const real =
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day;

	if (!real) {
		return { ok: false, error: 'that date does not exist' };
	}
	if (year < 2000) {
		return { ok: false, error: 'date is too far back' };
	}
	if (date > todayIso()) {
		return { ok: false, error: 'date is in the future' };
	}

	return { ok: true, date };
}

function readAmount(raw: string | undefined): { ok: true; amount: number } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') {
		return { ok: false, error: 'amount is required' };
	}

	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, error: 'amount has to be a positive number' };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `amount is capped at ${MAX_AMOUNT}` };
	}

	return { ok: true, amount };
}

function readCurrency(raw: string | undefined): { ok: true; currency: Money } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') {
		return { ok: true, currency: 'INR' };
	}

	const currency = raw.trim().toUpperCase();
	if (currency === 'INR' || currency === 'USD') {
		return { ok: true, currency };
	}

	return { ok: false, error: 'currency has to be INR or USD' };
}

function pickBasket(raw: string | undefined): { ok: true; list: Asset[] } | { ok: false; error: string; supported: string[] } {
	const supported = ASSETS.map((asset) => asset.id);
	if (raw == null || raw.trim() === '') {
		return { ok: true, list: [...ASSETS] };
	}

	const ids = raw
		.split(',')
		.map((part) => part.trim().toLowerCase())
		.filter((part) => part.length > 0);

	if (ids.length === 0) {
		return { ok: false, error: 'only was empty', supported };
	}

	const list: Asset[] = [];
	for (const id of ids) {
		const found = ASSETS.find((asset) => asset.id === id);
		if (!found) {
			return { ok: false, error: `unknown asset ${id}`, supported };
		}
		if (!list.some((asset) => asset.id === found.id)) {
			list.push(found);
		}
	}

	return { ok: true, list };
}

// INR=X is rupees for one dollar. everything else gets dragged through that
// so a rupee pile and a dollar stock can sit in the same column.
function intoUsd(amount: number, currency: string, usdInr: number): number {
	if (currency === 'USD') return amount;
	if (currency === 'INR') return amount / usdInr;
	throw new Error(`can't price ${currency}`);
}

function outOfUsd(usd: number, currency: string, usdInr: number): number {
	if (currency === 'USD') return usd;
	if (currency === 'INR') return usd * usdInr;
	throw new Error(`can't price ${currency}`);
}

function grown(
	amount: number,
	userCurrency: Money,
	usdInrThen: number,
	usdInrNow: number,
	assetCurrency: string,
	priceThen: number,
	priceNow: number
): number {
	const startUsd = intoUsd(amount, userCurrency, usdInrThen);
	const startInAsset = outOfUsd(startUsd, assetCurrency, usdInrThen);
	const units = startInAsset / priceThen;
	const endUsd = intoUsd(units * priceNow, assetCurrency, usdInrNow);
	return outOfUsd(endUsd, userCurrency, usdInrNow);
}

function rowFrom(id: string, name: string, symbol: string | null, usedDate: string | null, priceThen: number | null, priceNow: number | null, amount: number, value: number): Row {
	return {
		id,
		name,
		symbol,
		usedDate,
		priceThen: priceThen == null ? null : roundTo(priceThen, 4),
		priceNow: priceNow == null ? null : roundTo(priceNow, 4),
		valueNow: roundTo(value, 2),
		profit: roundTo(value - amount, 2),
		multiple: roundTo(value / amount, 4)
	};
}

function cashRows(amount: number, currency: Money, usdInrThen: number, usdInrNow: number, fxDate: string): Row[] {
	const mattress = rowFrom('cash', currency === 'INR' ? 'Rupees under the mattress' : 'Dollars under the mattress', null, null, null, null, amount, amount);

	// the other currency, held as cash. this is where a weaker rupee shows up
	// even if you never bought a stock.
	if (currency === 'INR') {
		const value = (amount / usdInrThen) * usdInrNow;
		return [
			mattress,
			rowFrom('dollars', 'US dollars', FX, fxDate, usdInrThen, usdInrNow, amount, value)
		];
	}

	const value = (amount * usdInrThen) / usdInrNow;
	return [
		mattress,
		rowFrom('rupees', 'Indian rupees', FX, fxDate, usdInrThen, usdInrNow, amount, value)
	];
}

function times(multiple: number): string {
	return `${roundTo(multiple, 2)}x`;
}

function sayIt(winner: Row, loser: Row, amount: number, currency: Money): string {
	const pile = currency === 'INR' ? 'rupees' : 'dollars';

	if (winner.id === 'cash') {
		return `Doing nothing beat the basket. ${loser.name} was the painful one, down to ${times(loser.multiple)}.`;
	}

	if (winner.id === 'dollars' || winner.id === 'rupees') {
		return `Just holding ${winner.name.toLowerCase()} beat the basket (${times(winner.multiple)}). ${loser.name} did ${times(loser.multiple)}.`;
	}

	if (loser.multiple < 1) {
		return `${winner.name} did ${times(winner.multiple)}. ${loser.name} went the other way, to ${times(loser.multiple)}. The ${pile} under the mattress are still ${amount}.`;
	}

	return `${winner.name} did ${times(winner.multiple)}. The ${pile} under the mattress are still ${amount}.`;
}

async function priceOne(asset: Asset, date: string, amount: number, userCurrency: Money, usdInrThen: number, usdInrNow: number): Promise<{ ok: true; row: Row } | { ok: false; skip: Skip }> {
	try {
		const [thenBar, now] = await Promise.all([
			loadDailyClose(asset.yahoo, date),
			loadYahooQuote(asset.yahoo)
		]);

		const assetCurrency = thenBar.currency || now.currency;
		const value = grown(amount, userCurrency, usdInrThen, usdInrNow, assetCurrency, thenBar.close, now.price);

		return {
			ok: true,
			row: rowFrom(asset.id, asset.name, thenBar.symbol, thenBar.date, thenBar.close, now.price, amount, value)
		};
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		return { ok: false, skip: { id: asset.id, reason } };
	}
}

regret.get('/', async (c) => {
	const date = readDate(c.req.query('date'));
	if (!date.ok) return c.json({ ok: false, error: date.error }, 400);

	const amount = readAmount(c.req.query('amount'));
	if (!amount.ok) return c.json({ ok: false, error: amount.error }, 400);

	const currency = readCurrency(c.req.query('currency'));
	if (!currency.ok) return c.json({ ok: false, error: currency.error }, 400);

	const basket = pickBasket(c.req.query('only'));
	if (!basket.ok) {
		return c.json({ ok: false, error: basket.error, supported: basket.supported }, 400);
	}

	const cacheKey = `${date.date}|${amount.amount}|${currency.currency}|${basket.list.map((asset) => asset.id).join(',')}`;
	const hit = remembered.get(cacheKey);
	if (hit && Date.now() < hit.goodUntil) {
		return c.json(hit.body);
	}

	let usdInrThen: number;
	let usdInrNow: number;
	let fxDate: string;

	try {
		const [fxThen, fxNow] = await Promise.all([loadDailyClose(FX, date.date), loadYahooQuote(FX)]);
		usdInrThen = fxThen.close;
		usdInrNow = fxNow.price;
		fxDate = fxThen.date;
	} catch (err) {
		return c.json(upstreamError(err, 'could not load the rupee rate'), 502);
	}

	const settled = await Promise.all(
		basket.list.map((asset) => priceOne(asset, date.date, amount.amount, currency.currency, usdInrThen, usdInrNow))
	);

	const rows: Row[] = [];
	const skipped: Skip[] = [];
	for (const item of settled) {
		if (item.ok) rows.push(item.row);
		else skipped.push(item.skip);
	}

	if (rows.length === 0) {
		return c.json(
			{
				ok: false,
				error: 'none of those assets had a price',
				skipped
			},
			502
		);
	}

	const assets = [...rows, ...cashRows(amount.amount, currency.currency, usdInrThen, usdInrNow, fxDate)];
	let winner = assets[0];
	let loser = assets[0];
	for (const asset of assets) {
		if (asset.multiple > winner.multiple) winner = asset;
		if (asset.multiple < loser.multiple) loser = asset;
	}

	const body = {
		ok: true,
		date: date.date,
		usedDate: fxDate,
		amount: amount.amount,
		currency: currency.currency,
		usdInrThen: roundTo(usdInrThen, 4),
		usdInrNow: roundTo(usdInrNow, 4),
		winner: { id: winner.id, name: winner.name, multiple: winner.multiple, valueNow: winner.valueNow },
		loser: { id: loser.id, name: loser.name, multiple: loser.multiple, valueNow: loser.valueNow },
		verdict: sayIt(winner, loser, amount.amount, currency.currency),
		assets,
		skipped
	};

	remembered.set(cacheKey, { body, goodUntil: Date.now() + RESULT_CACHE_MS });
	return c.json(body);
});

export default regret;
