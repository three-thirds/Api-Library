import { Hono } from 'hono';
import type { Context } from 'hono';

// same shop as gold. XAG is one troy ounce of silver in USD, and the
// troy ounce is still 31.1034768 grams. silver gets quoted per kg a lot
// in industrial quotes, so the kg row is the one people actually compare.

const UPSTREAM = 'https://api.gold-api.com/price/XAG';
const CACHE_FOR_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8_000;
const TROY_OUNCE_IN_GRAMS = 31.1034768;
const TOLA_IN_GRAMS = 11.6638038;
const MAX_AMOUNT = 1_000_000;
const HISTORY_LIMIT = 20;

type UnitName = 'oz' | 'g' | 'kg' | 'tola' | '10g';

type UnitInfo = {
	name: UnitName;
	label: string;
	grams: number;
};

const UNITS: UnitInfo[] = [
	{ name: 'oz', label: 'troy ounce', grams: TROY_OUNCE_IN_GRAMS },
	{ name: 'g', label: 'gram', grams: 1 },
	{ name: '10g', label: '10 grams', grams: 10 },
	{ name: 'tola', label: 'tola', grams: TOLA_IN_GRAMS },
	{ name: 'kg', label: 'kilogram', grams: 1000 }
];

const UNIT_BY_NAME = new Map(UNITS.map((unit) => [unit.name, unit]));

type Spot = {
	pricePerOunceUsd: number;
	updatedAt: string;
	fetchedAt: number;
	fromCache: boolean;
	stale: boolean;
};

type CacheBox = {
	spot: Spot;
	goodUntil: number;
};

let box: CacheBox | null = null;
const seen: Spot[] = [];

function roundToCents(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function aliasesFor(raw: string): UnitName | null {
	switch (raw) {
		case 'oz':
		case 'ozt':
		case 'ounce':
		case 'ounces':
		case 'troy':
			return 'oz';
		case 'g':
		case 'gram':
		case 'grams':
			return 'g';
		case '10g':
		case '10gram':
		case '10grams':
			return '10g';
		case 'tola':
		case 'tolas':
			return 'tola';
		case 'kg':
		case 'kilo':
		case 'kilogram':
		case 'kilograms':
			return 'kg';
		default:
			return null;
	}
}

function unitFromQuery(raw: string | undefined): UnitInfo | null {
	if (raw == null || raw.trim() === '') {
		return UNIT_BY_NAME.get('oz') ?? null;
	}

	const name = aliasesFor(raw.trim().toLowerCase());
	if (!name) return null;
	return UNIT_BY_NAME.get(name) ?? null;
}

function amountFromQuery(raw: string | undefined): { ok: true; amount: number } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') {
		return { ok: true, amount: 1 };
	}

	const amount = Number(raw);
	if (!Number.isFinite(amount)) {
		return { ok: false, error: 'amount has to be a number' };
	}
	if (amount <= 0) {
		return { ok: false, error: 'amount has to be greater than 0' };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `amount is capped at ${MAX_AMOUNT}` };
	}

	return { ok: true, amount };
}

function usdForGrams(pricePerOunceUsd: number, grams: number): number {
	const perGram = pricePerOunceUsd / TROY_OUNCE_IN_GRAMS;
	return perGram * grams;
}

function conversions(pricePerOunceUsd: number) {
	return UNITS.map((unit) => ({
		unit: unit.name,
		label: unit.label,
		grams: unit.grams,
		usd: roundToCents(usdForGrams(pricePerOunceUsd, unit.grams))
	}));
}

function remember(spot: Spot) {
	if (spot.fromCache) return;

	seen.push(spot);
	while (seen.length > HISTORY_LIMIT) {
		seen.shift();
	}
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function readUpstream(payload: unknown, fetchedAt: number): Spot {
	const body = asRecord(payload);
	if (!body) {
		throw new Error('upstream did not return an object');
	}

	const price = Number(body.price);
	if (!Number.isFinite(price) || price <= 0) {
		throw new Error('upstream price was missing');
	}

	const symbol = typeof body.symbol === 'string' ? body.symbol : '';
	if (symbol && symbol !== 'XAG') {
		throw new Error(`upstream sent ${symbol}, wanted XAG`);
	}

	const updatedAt =
		typeof body.updatedAt === 'string' && body.updatedAt.length > 0
			? body.updatedAt
			: new Date(fetchedAt).toISOString();

	return {
		pricePerOunceUsd: price,
		updatedAt,
		fetchedAt,
		fromCache: false,
		stale: false
	};
}

async function pullUpstream(): Promise<Spot> {
	const res = await fetch(UPSTREAM, {
		headers: {
			accept: 'application/json'
		},
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	});

	if (!res.ok) {
		throw new Error(`upstream responded ${res.status}`);
	}

	const payload = await res.json();
	return readUpstream(payload, Date.now());
}

async function loadSpot(): Promise<Spot> {
	const now = Date.now();

	if (box && now < box.goodUntil) {
		return {
			...box.spot,
			fromCache: true,
			stale: false
		};
	}

	try {
		const fresh = await pullUpstream();
		box = {
			spot: fresh,
			goodUntil: fresh.fetchedAt + CACHE_FOR_MS
		};
		remember(fresh);
		return fresh;
	} catch (err) {
		if (box) {
			return {
				...box.spot,
				fromCache: true,
				stale: true
			};
		}
		throw err;
	}
}

function quoteJson(spot: Spot, amount: number, unit: UnitInfo) {
	const perUnit = usdForGrams(spot.pricePerOunceUsd, unit.grams);

	return {
		ok: true,
		metal: 'silver',
		symbol: 'XAG',
		currency: 'USD',
		// plain /silver still means "usd for one troy ounce"
		price: spot.pricePerOunceUsd,
		updatedAt: spot.updatedAt,
		unit: unit.name,
		unitLabel: unit.label,
		amount,
		pricePerUnit: roundToCents(perUnit),
		totalUsd: roundToCents(perUnit * amount),
		conversions: conversions(spot.pricePerOunceUsd),
		cached: spot.fromCache,
		stale: spot.stale,
		ageMs: Date.now() - spot.fetchedAt
	};
}

function upstreamError(err: unknown) {
	const details = err instanceof Error ? err.message : String(err);
	return {
		ok: false,
		error: 'could not load the silver price',
		details
	} as const;
}

async function handleQuote(c: Context) {
	const unit = unitFromQuery(c.req.query('unit'));
	if (!unit) {
		return c.json(
			{
				ok: false,
				error: 'unknown unit',
				supported: UNITS.map((item) => item.name)
			},
			400
		);
	}

	const amount = amountFromQuery(c.req.query('amount'));
	if (!amount.ok) {
		return c.json({ ok: false, error: amount.error }, 400);
	}

	try {
		const spot = await loadSpot();
		return c.json(quoteJson(spot, amount.amount, unit));
	} catch (err) {
		return c.json(upstreamError(err), 502);
	}
}

const silver = new Hono();

silver.get('/', handleQuote);
silver.get('/usd', handleQuote);

silver.get('/units', async (c) => {
	try {
		const spot = await loadSpot();
		return c.json({
			ok: true,
			metal: 'silver',
			symbol: 'XAG',
			currency: 'USD',
			price: spot.pricePerOunceUsd,
			updatedAt: spot.updatedAt,
			cached: spot.fromCache,
			stale: spot.stale,
			units: conversions(spot.pricePerOunceUsd)
		});
	} catch (err) {
		return c.json(upstreamError(err), 502);
	}
});

silver.get('/history', (c) => {
	return c.json({
		ok: true,
		note: 'quotes this process has actually fetched, oldest first. gone on restart.',
		count: seen.length,
		quotes: seen.map((spot) => ({
			price: roundToCents(spot.pricePerOunceUsd),
			currency: 'USD',
			unit: 'oz',
			updatedAt: spot.updatedAt,
			fetchedAt: new Date(spot.fetchedAt).toISOString()
		}))
	});
});

export default silver;
