import { Hono } from 'hono';
import type { Context } from 'hono';

// crude isn't on the metals feed. WTI and Brent both trade as futures,
// quoted in USD per barrel. a barrel is 42 US gallons, which is not the
// same as 42 imperial gallons. mixing those up is how oil math goes bad.

const CACHE_FOR_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_AMOUNT = 1_000_000;
const HISTORY_LIMIT = 20;

// 1 US gallon = 3.785411784 litres, and the oil barrel is defined as 42 of those.
const LITRES_PER_BARREL = 42 * 3.785411784;
const IMPERIAL_GALLONS_PER_BARREL = LITRES_PER_BARREL / 4.54609;

type BenchmarkName = 'wti' | 'brent';

type Benchmark = {
	name: BenchmarkName;
	label: string;
	yahooSymbol: string;
};

const BENCHMARKS: Record<BenchmarkName, Benchmark> = {
	wti: {
		name: 'wti',
		label: 'West Texas Intermediate',
		yahooSymbol: 'CL=F'
	},
	brent: {
		name: 'brent',
		label: 'Brent',
		yahooSymbol: 'BZ=F'
	}
};

type UnitName = 'bbl' | 'gal' | 'l' | 'impgal';

type UnitInfo = {
	name: UnitName;
	label: string;
	// how many of this unit sit in one barrel
	perBarrel: number;
};

const UNITS: UnitInfo[] = [
	{ name: 'bbl', label: 'barrel', perBarrel: 1 },
	{ name: 'gal', label: 'US gallon', perBarrel: 42 },
	{ name: 'l', label: 'litre', perBarrel: LITRES_PER_BARREL },
	{ name: 'impgal', label: 'imperial gallon', perBarrel: IMPERIAL_GALLONS_PER_BARREL }
];

const UNIT_BY_NAME = new Map(UNITS.map((unit) => [unit.name, unit]));

type Spot = {
	benchmark: BenchmarkName;
	symbol: string;
	pricePerBarrelUsd: number;
	previousClose: number | null;
	change: number | null;
	changePercent: number | null;
	dayHigh: number | null;
	dayLow: number | null;
	updatedAt: string;
	fetchedAt: number;
	fromCache: boolean;
	stale: boolean;
};

type CacheBox = {
	spot: Spot;
	goodUntil: number;
};

const boxes = new Map<BenchmarkName, CacheBox>();
const seen: Spot[] = [];

function roundToCents(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function optionalNumber(value: unknown): number | null {
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return n;
}

function aliasesForUnit(raw: string): UnitName | null {
	switch (raw) {
		case 'bbl':
		case 'barrel':
		case 'barrels':
			return 'bbl';
		case 'gal':
		case 'gallon':
		case 'gallons':
		case 'usgal':
		case 'usgallon':
			return 'gal';
		case 'l':
		case 'lt':
		case 'litre':
		case 'litres':
		case 'liter':
		case 'liters':
			return 'l';
		case 'impgal':
		case 'ukgal':
		case 'imperial':
		case 'imperialgallon':
			return 'impgal';
		default:
			return null;
	}
}

function unitFromQuery(raw: string | undefined): UnitInfo | null {
	if (raw == null || raw.trim() === '') {
		return UNIT_BY_NAME.get('bbl') ?? null;
	}

	const name = aliasesForUnit(raw.trim().toLowerCase());
	if (!name) return null;
	return UNIT_BY_NAME.get(name) ?? null;
}

function benchmarkFromQuery(raw: string | undefined): Benchmark | null {
	if (raw == null || raw.trim() === '') {
		return BENCHMARKS.wti;
	}

	switch (raw.trim().toLowerCase()) {
		case 'wti':
		case 'cl':
		case 'west texas':
		case 'westtexas':
			return BENCHMARKS.wti;
		case 'brent':
		case 'bz':
		case 'uk':
			return BENCHMARKS.brent;
		default:
			return null;
	}
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

function usdForUnit(pricePerBarrelUsd: number, unit: UnitInfo): number {
	return pricePerBarrelUsd / unit.perBarrel;
}

function conversions(pricePerBarrelUsd: number) {
	return UNITS.map((unit) => ({
		unit: unit.name,
		label: unit.label,
		// the litre ratio is 42 * 3.785411784 and does not land on a tidy binary float
		perBarrel: Math.round(unit.perBarrel * 1e6) / 1e6,
		usd: roundToCents(usdForUnit(pricePerBarrelUsd, unit))
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

function chartUrl(benchmark: Benchmark): string {
	const symbol = encodeURIComponent(benchmark.yahooSymbol);
	return `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
}

function readUpstream(payload: unknown, benchmark: Benchmark, fetchedAt: number): Spot {
	const root = asRecord(payload);
	const chart = asRecord(root?.chart);
	const rows = chart?.result;
	const first = Array.isArray(rows) ? rows[0] : null;
	const meta = asRecord(asRecord(first)?.meta);

	if (!meta) {
		const err = asRecord(chart?.error);
		const description = typeof err?.description === 'string' ? err.description : 'yahoo chart had no quote';
		throw new Error(description);
	}

	const price = Number(meta.regularMarketPrice);
	if (!Number.isFinite(price) || price <= 0) {
		throw new Error('upstream price was missing');
	}

	const marketTime = Number(meta.regularMarketTime);
	const updatedAt =
		Number.isFinite(marketTime) && marketTime > 0
			? new Date(marketTime * 1000).toISOString()
			: new Date(fetchedAt).toISOString();

	const previousClose = optionalNumber(meta.chartPreviousClose);
	const change = optionalNumber(meta.fulldayChange);
	let changePercent = optionalNumber(meta.regularMarketChangePercent);
	if (changePercent == null && change != null && previousClose) {
		changePercent = (change / previousClose) * 100;
	}

	return {
		benchmark: benchmark.name,
		symbol: typeof meta.symbol === 'string' ? meta.symbol : benchmark.yahooSymbol,
		pricePerBarrelUsd: price,
		previousClose,
		change,
		changePercent,
		dayHigh: optionalNumber(meta.regularMarketDayHigh),
		dayLow: optionalNumber(meta.regularMarketDayLow),
		updatedAt,
		fetchedAt,
		fromCache: false,
		stale: false
	};
}

async function pullUpstream(benchmark: Benchmark): Promise<Spot> {
	const res = await fetch(chartUrl(benchmark), {
		headers: {
			accept: 'application/json',
			// yahoo answers an empty user agent with a block page
			'user-agent': 'threethirds-api'
		},
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	});

	if (!res.ok) {
		throw new Error(`upstream responded ${res.status}`);
	}

	const payload = await res.json();
	return readUpstream(payload, benchmark, Date.now());
}

async function loadSpot(benchmark: Benchmark): Promise<Spot> {
	const now = Date.now();
	const box = boxes.get(benchmark.name);

	if (box && now < box.goodUntil) {
		return {
			...box.spot,
			fromCache: true,
			stale: false
		};
	}

	try {
		const fresh = await pullUpstream(benchmark);
		boxes.set(benchmark.name, {
			spot: fresh,
			goodUntil: fresh.fetchedAt + CACHE_FOR_MS
		});
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
	const benchmark = BENCHMARKS[spot.benchmark];
	const perUnit = usdForUnit(spot.pricePerBarrelUsd, unit);

	return {
		ok: true,
		commodity: 'crude oil',
		benchmark: benchmark.name,
		benchmarkLabel: benchmark.label,
		symbol: spot.symbol,
		currency: 'USD',
		// plain /oil means "usd for one barrel" of the chosen benchmark
		price: spot.pricePerBarrelUsd,
		previousClose: spot.previousClose,
		change: spot.change == null ? null : roundToCents(spot.change),
		changePercent: spot.changePercent == null ? null : roundToCents(spot.changePercent),
		dayHigh: spot.dayHigh == null ? null : roundToCents(spot.dayHigh),
		dayLow: spot.dayLow == null ? null : roundToCents(spot.dayLow),
		updatedAt: spot.updatedAt,
		unit: unit.name,
		unitLabel: unit.label,
		amount,
		pricePerUnit: roundToCents(perUnit),
		totalUsd: roundToCents(perUnit * amount),
		conversions: conversions(spot.pricePerBarrelUsd),
		cached: spot.fromCache,
		stale: spot.stale,
		ageMs: Date.now() - spot.fetchedAt
	};
}

function upstreamError(err: unknown) {
	const details = err instanceof Error ? err.message : String(err);
	return {
		ok: false,
		error: 'could not load the crude oil price',
		details
	} as const;
}

async function handleQuote(c: Context, forced?: BenchmarkName) {
	const benchmark = forced ? BENCHMARKS[forced] : benchmarkFromQuery(c.req.query('benchmark'));
	if (!benchmark) {
		return c.json(
			{
				ok: false,
				error: 'unknown benchmark',
				supported: ['wti', 'brent']
			},
			400
		);
	}

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
		const spot = await loadSpot(benchmark);
		return c.json(quoteJson(spot, amount.amount, unit));
	} catch (err) {
		return c.json(upstreamError(err), 502);
	}
}

const oil = new Hono();

oil.get('/', (c) => handleQuote(c));
oil.get('/usd', (c) => handleQuote(c));
oil.get('/wti', (c) => handleQuote(c, 'wti'));
oil.get('/brent', (c) => handleQuote(c, 'brent'));

oil.get('/units', async (c) => {
	const benchmark = benchmarkFromQuery(c.req.query('benchmark'));
	if (!benchmark) {
		return c.json(
			{
				ok: false,
				error: 'unknown benchmark',
				supported: ['wti', 'brent']
			},
			400
		);
	}

	try {
		const spot = await loadSpot(benchmark);
		return c.json({
			ok: true,
			commodity: 'crude oil',
			benchmark: benchmark.name,
			benchmarkLabel: benchmark.label,
			symbol: spot.symbol,
			currency: 'USD',
			price: spot.pricePerBarrelUsd,
			updatedAt: spot.updatedAt,
			cached: spot.fromCache,
			stale: spot.stale,
			units: conversions(spot.pricePerBarrelUsd)
		});
	} catch (err) {
		return c.json(upstreamError(err), 502);
	}
});

oil.get('/history', (c) => {
	const filter = c.req.query('benchmark');
	const wanted = filter == null || filter.trim() === '' ? null : benchmarkFromQuery(filter);
	if (filter && filter.trim() !== '' && !wanted) {
		return c.json(
			{
				ok: false,
				error: 'unknown benchmark',
				supported: ['wti', 'brent']
			},
			400
		);
	}

	const quotes = seen.filter((spot) => (wanted ? spot.benchmark === wanted.name : true));

	return c.json({
		ok: true,
		note: 'quotes this process has actually fetched, oldest first. gone on restart.',
		count: quotes.length,
		quotes: quotes.map((spot) => ({
			benchmark: spot.benchmark,
			symbol: spot.symbol,
			price: roundToCents(spot.pricePerBarrelUsd),
			currency: 'USD',
			unit: 'bbl',
			change: spot.change == null ? null : roundToCents(spot.change),
			updatedAt: spot.updatedAt,
			fetchedAt: new Date(spot.fetchedAt).toISOString()
		}))
	});
});

export default oil;
