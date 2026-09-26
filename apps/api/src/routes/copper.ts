import { Hono } from 'hono';
import type { Context } from 'hono';

// Copper on this feed is dollars per avoirdupois pound, the 453.6 gram
// one. That is not the troy ounce used for gold. Sixteen of these ounces
// make a pound, and a tonne is 1000 kilograms.

const UPSTREAM = 'https://api.gold-api.com/price/HG';
const CACHE_FOR_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8_000;
const GRAMS_PER_POUND = 453.59237;
const MAX_AMOUNT = 1_000_000;

type UnitName = 'lb' | 'oz' | 'kg' | 't';

type UnitInfo = {
	name: UnitName;
	label: string;
	pounds: number;
};

const UNITS: UnitInfo[] = [
	{ name: 'lb', label: 'pound', pounds: 1 },
	{ name: 'oz', label: 'ounce', pounds: 1 / 16 },
	{ name: 'kg', label: 'kilogram', pounds: 1000 / GRAMS_PER_POUND },
	{ name: 't', label: 'tonne', pounds: 1_000_000 / GRAMS_PER_POUND }
];

const UNIT_BY_NAME = new Map(UNITS.map((unit) => [unit.name, unit]));

type Spot = {
	pricePerPoundUsd: number;
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

function roundToCents(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function aliasesFor(raw: string): UnitName | null {
	switch (raw) {
		case 'lb':
		case 'lbs':
		case 'pound':
		case 'pounds':
			return 'lb';
		case 'oz':
		case 'ounce':
		case 'ounces':
			return 'oz';
		case 'kg':
		case 'kilo':
		case 'kilogram':
		case 'kilograms':
			return 'kg';
		case 't':
		case 'tonne':
		case 'tonnes':
		case 'metric':
			return 't';
		default:
			return null;
	}
}

function unitFromQuery(raw: string | undefined): UnitInfo | null {
	if (raw == null || raw.trim() === '') return UNIT_BY_NAME.get('lb') ?? null;
	const name = aliasesFor(raw.trim().toLowerCase());
	if (!name) return null;
	return UNIT_BY_NAME.get(name) ?? null;
}

function amountFromQuery(raw: string | undefined): { ok: true; amount: number } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') return { ok: true, amount: 1 };

	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, error: 'amount has to be greater than 0' };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `amount is capped at ${MAX_AMOUNT}` };
	}
	return { ok: true, amount };
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function readUpstream(payload: unknown, fetchedAt: number): Spot {
	const body = asRecord(payload);
	if (!body) throw new Error('upstream did not return an object');

	const price = Number(body.price);
	if (!Number.isFinite(price) || price <= 0) throw new Error('upstream price was missing');

	const symbol = typeof body.symbol === 'string' ? body.symbol : '';
	if (symbol && symbol !== 'HG') throw new Error(`upstream sent ${symbol}, wanted HG`);

	const updatedAt =
		typeof body.updatedAt === 'string' && body.updatedAt.length > 0
			? body.updatedAt
			: new Date(fetchedAt).toISOString();

	return {
		pricePerPoundUsd: price,
		updatedAt,
		fetchedAt,
		fromCache: false,
		stale: false
	};
}

async function loadSpot(): Promise<Spot> {
	const now = Date.now();
	if (box && now < box.goodUntil) {
		return { ...box.spot, fromCache: true, stale: false };
	}

	try {
		const res = await fetch(UPSTREAM, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
		});
		if (!res.ok) throw new Error(`upstream responded ${res.status}`);

		const fresh = readUpstream(await res.json(), Date.now());
		box = { spot: fresh, goodUntil: fresh.fetchedAt + CACHE_FOR_MS };
		return fresh;
	} catch (err) {
		if (box) return { ...box.spot, fromCache: true, stale: true };
		throw err;
	}
}

function upstreamError(err: unknown) {
	const details = err instanceof Error ? err.message : String(err);
	return { ok: false, error: 'could not load the copper price', details } as const;
}

async function handleQuote(c: Context) {
	const unit = unitFromQuery(c.req.query('unit'));
	if (!unit) {
		return c.json({ ok: false, error: 'unknown unit', supported: UNITS.map((item) => item.name) }, 400);
	}

	const amount = amountFromQuery(c.req.query('amount'));
	if (!amount.ok) return c.json({ ok: false, error: amount.error }, 400);

	try {
		const spot = await loadSpot();
		const perUnit = spot.pricePerPoundUsd * unit.pounds;
		return c.json({
			ok: true,
			metal: 'copper',
			symbol: 'HG',
			currency: 'USD',
			price: spot.pricePerPoundUsd,
			updatedAt: spot.updatedAt,
			unit: unit.name,
			unitLabel: unit.label,
			amount: amount.amount,
			pricePerUnit: roundToCents(perUnit),
			totalUsd: roundToCents(perUnit * amount.amount),
			conversions: UNITS.map((item) => ({
				unit: item.name,
				label: item.label,
				usd: roundToCents(spot.pricePerPoundUsd * item.pounds)
			})),
			cached: spot.fromCache,
			stale: spot.stale,
			ageMs: Date.now() - spot.fetchedAt
		});
	} catch (err) {
		return c.json(upstreamError(err), 502);
	}
}

const copper = new Hono();

copper.get('/', handleQuote);
copper.get('/usd', handleQuote);

export default copper;
