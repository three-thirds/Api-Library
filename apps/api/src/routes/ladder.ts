import { Hono } from 'hono';
import { loadDailyClose, loadYahooQuote, roundTo, upstreamError } from '../yahoo';

// regret, but you pick the mix. weights have to add to one.
// cash you never invested is still in the list so the buys have
// something dull to beat.

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
const MAX_BUYS = 6;
const WEIGHT_TOLERANCE = 0.001;
const RESULT_CACHE_MS = 60 * 1000;

type Money = 'INR' | 'USD';

type Buy = {
	asset: Asset;
	weight: number;
};

type Row = {
	id: string;
	name: string;
	symbol: string | null;
	weight: number;
	slice: number;
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

const ladder = new Hono();
const remembered = new Map<string, { body: unknown; goodUntil: number }>();

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function readDate(raw: unknown): { ok: true; date: string } | { ok: false; error: string } {
	if (typeof raw !== 'string' || raw.trim() === '') {
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

	if (!real) return { ok: false, error: 'that date does not exist' };
	if (year < 2000) return { ok: false, error: 'date is too far back' };
	if (date > todayIso()) return { ok: false, error: 'date is in the future' };

	return { ok: true, date };
}

function readAmount(raw: unknown): { ok: true; amount: number } | { ok: false; error: string } {
	const amount = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, error: 'amount has to be a positive number' };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `amount is capped at ${MAX_AMOUNT}` };
	}
	return { ok: true, amount };
}

function readCurrency(raw: unknown): { ok: true; currency: Money } | { ok: false; error: string } {
	if (raw == null || raw === '') return { ok: true, currency: 'INR' };
	if (typeof raw !== 'string') return { ok: false, error: 'currency has to be INR or USD' };
	const currency = raw.trim().toUpperCase();
	if (currency === 'INR' || currency === 'USD') return { ok: true, currency };
	return { ok: false, error: 'currency has to be INR or USD' };
}

function parseBuys(raw: unknown): { ok: true; buys: Buy[] } | { ok: false; error: string; supported?: string[] } {
	const supported = ASSETS.map((a) => a.id);
	if (!Array.isArray(raw)) {
		return { ok: false, error: 'buys has to be an array', supported };
	}
	if (raw.length === 0) {
		return { ok: false, error: 'buys cannot be empty', supported };
	}
	if (raw.length > MAX_BUYS) {
		return { ok: false, error: `buys is capped at ${MAX_BUYS}`, supported };
	}

	const merged = new Map<string, Buy>();

	for (let i = 0; i < raw.length; i++) {
		const item = raw[i];
		if (item == null || typeof item !== 'object' || Array.isArray(item)) {
			return { ok: false, error: `buys[${i}] has to be an object`, supported };
		}
		const row = item as Record<string, unknown>;
		if (typeof row.id !== 'string' || row.id.trim() === '') {
			return { ok: false, error: `buys[${i}].id has to be a string`, supported };
		}

		const id = row.id.trim().toLowerCase();
		const asset = ASSETS.find((a) => a.id === id);
		if (!asset) {
			return { ok: false, error: `unknown asset ${id}`, supported };
		}

		const weight = typeof row.weight === 'number' ? row.weight : Number(row.weight);
		if (!Number.isFinite(weight) || weight <= 0) {
			return { ok: false, error: `buys[${i}].weight has to be a positive number`, supported };
		}

		const existing = merged.get(asset.id);
		if (existing) existing.weight += weight;
		else merged.set(asset.id, { asset, weight });
	}

	const buys = [...merged.values()];
	const sum = buys.reduce((s, b) => s + b.weight, 0);
	if (Math.abs(sum - 1) > WEIGHT_TOLERANCE) {
		return { ok: false, error: 'weights have to add up to 1', supported };
	}

	return { ok: true, buys };
}

function parseBody(body: unknown):
	| { ok: true; date: string; amount: number; currency: Money; buys: Buy[] }
	| { ok: false; error: string; supported?: string[] } {
	if (body == null || typeof body !== 'object' || Array.isArray(body)) {
		return { ok: false, error: 'body has to be a json object' };
	}

	const record = body as Record<string, unknown>;
	const date = readDate(record.date);
	if (!date.ok) return date;

	const amount = readAmount(record.amount);
	if (!amount.ok) return amount;

	const currency = readCurrency(record.currency);
	if (!currency.ok) return currency;

	const buys = parseBuys(record.buys);
	if (!buys.ok) return buys;

	return {
		ok: true,
		date: date.date,
		amount: amount.amount,
		currency: currency.currency,
		buys: buys.buys
	};
}

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

function rowFrom(
	id: string,
	name: string,
	symbol: string | null,
	weight: number,
	slice: number,
	usedDate: string | null,
	priceThen: number | null,
	priceNow: number | null,
	value: number
): Row {
	return {
		id,
		name,
		symbol,
		weight: roundTo(weight, 4),
		slice: roundTo(slice, 2),
		usedDate,
		priceThen: priceThen == null ? null : roundTo(priceThen, 4),
		priceNow: priceNow == null ? null : roundTo(priceNow, 4),
		valueNow: roundTo(value, 2),
		profit: roundTo(value - slice, 2),
		multiple: roundTo(value / slice, 4)
	};
}

function times(multiple: number): string {
	return `${roundTo(multiple, 2)}x`;
}

function sayIt(winner: Row, loser: Row, amount: number, currency: Money): string {
	const pile = currency === 'INR' ? 'rupees' : 'dollars';
	if (winner.id === 'cash') {
		return `Doing nothing beat the ladder. ${loser.name} was the painful one, down to ${times(loser.multiple)}.`;
	}
	if (loser.multiple < 1) {
		return `${winner.name} did ${times(winner.multiple)}. ${loser.name} went the other way, to ${times(loser.multiple)}. The ${pile} under the mattress are still ${amount}.`;
	}
	return `${winner.name} did ${times(winner.multiple)}. The ${pile} under the mattress are still ${amount}.`;
}

async function priceBuy(
	buy: Buy,
	date: string,
	slice: number,
	userCurrency: Money,
	usdInrThen: number,
	usdInrNow: number
): Promise<{ ok: true; row: Row } | { ok: false; skip: Skip }> {
	try {
		const [thenBar, now] = await Promise.all([
			loadDailyClose(buy.asset.yahoo, date),
			loadYahooQuote(buy.asset.yahoo)
		]);
		const assetCurrency = thenBar.currency || now.currency;
		const value = grown(
			slice,
			userCurrency,
			usdInrThen,
			usdInrNow,
			assetCurrency,
			thenBar.close,
			now.price
		);
		return {
			ok: true,
			row: rowFrom(
				buy.asset.id,
				buy.asset.name,
				thenBar.symbol,
				buy.weight,
				slice,
				thenBar.date,
				thenBar.close,
				now.price,
				value
			)
		};
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		return { ok: false, skip: { id: buy.asset.id, reason } };
	}
}

function cacheKey(date: string, amount: number, currency: Money, buys: Buy[]): string {
	const parts = buys
		.map((b) => `${b.asset.id}:${b.weight}`)
		.sort()
		.join(',');
	return `${date}|${amount}|${currency}|${parts}`;
}

ladder.get('/', (c) => {
	return c.json({
		ok: true,
		method: 'POST',
		path: '/api/v1/ladder',
		body: {
			date: '2020-03-23',
			amount: 100000,
			currency: 'INR or USD, defaults to INR',
			buys: [
				{ id: 'btc', weight: 0.4 },
				{ id: 'gold', weight: 0.3 },
				{ id: 'nifty', weight: 0.3 }
			]
		},
		assets: ASSETS.map((a) => ({ id: a.id, name: a.name, symbol: a.yahoo })),
		notes: [
			'weights have to add up to 1',
			'cash you never invested is always in the result',
			'same growth math as /regret, but you pick the mix'
		]
	});
});

ladder.post('/', async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ ok: false, error: 'body has to be json' }, 400);
	}

	const parsed = parseBody(body);
	if (!parsed.ok) {
		const payload: Record<string, unknown> = { ok: false, error: parsed.error };
		if (parsed.supported) payload.supported = parsed.supported;
		return c.json(payload, 400);
	}

	const { date, amount, currency, buys } = parsed;
	const key = cacheKey(date, amount, currency, buys);
	const hit = remembered.get(key);
	if (hit && Date.now() < hit.goodUntil) {
		return c.json(hit.body);
	}

	let usdInrThen: number;
	let usdInrNow: number;
	let fxDate: string;

	try {
		const [fxThen, fxNow] = await Promise.all([loadDailyClose(FX, date), loadYahooQuote(FX)]);
		usdInrThen = fxThen.close;
		usdInrNow = fxNow.price;
		fxDate = fxThen.date;
	} catch (err) {
		return c.json(upstreamError(err, 'could not load the rupee rate'), 502);
	}

	const settled = await Promise.all(
		buys.map((buy) =>
			priceBuy(buy, date, amount * buy.weight, currency, usdInrThen, usdInrNow)
		)
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
				error: 'none of those buys had a price',
				skipped
			},
			502
		);
	}

	const cash = rowFrom(
		'cash',
		currency === 'INR' ? 'Rupees under the mattress' : 'Dollars under the mattress',
		null,
		0,
		amount,
		null,
		null,
		null,
		amount
	);

	const assets = [...rows, cash];
	let winner = assets[0];
	let loser = assets[0];
	for (const asset of assets) {
		if (asset.multiple > winner.multiple) winner = asset;
		if (asset.multiple < loser.multiple) loser = asset;
	}

	const response = {
		ok: true,
		date,
		usedDate: fxDate,
		amount,
		currency,
		usdInrThen: roundTo(usdInrThen, 4),
		usdInrNow: roundTo(usdInrNow, 4),
		winner: {
			id: winner.id,
			name: winner.name,
			multiple: winner.multiple,
			valueNow: winner.valueNow
		},
		loser: {
			id: loser.id,
			name: loser.name,
			multiple: loser.multiple,
			valueNow: loser.valueNow
		},
		verdict: sayIt(winner, loser, amount, currency),
		assets,
		skipped
	};

	remembered.set(key, { body: response, goodUntil: Date.now() + RESULT_CACHE_MS });
	return c.json(response);
});

export default ladder;
