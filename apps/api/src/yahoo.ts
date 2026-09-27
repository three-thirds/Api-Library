// Yahoo's chart endpoint is what we use for anything that is not a
// troy-ounce metal. One minute of cache per symbol, and if the next
// pull fails we hand back the last good quote with stale set.

const CACHE_FOR_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8_000;

export type YahooQuote = {
	symbol: string;
	name: string | null;
	currency: string;
	exchange: string | null;
	price: number;
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
	quote: YahooQuote;
	goodUntil: number;
};

const boxes = new Map<string, CacheBox>();

export function roundTo(value: number, places: number): number {
	const scale = 10 ** places;
	return Math.round((value + Number.EPSILON) * scale) / scale;
}

function optionalNumber(value: unknown): number | null {
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return n;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value == null || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function chartUrl(symbol: string): string {
	return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
}

function readQuote(payload: unknown, requested: string, fetchedAt: number): YahooQuote {
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

	const shortName = typeof meta.shortName === 'string' ? meta.shortName : null;
	const longName = typeof meta.longName === 'string' ? meta.longName : null;
	const exchange =
		typeof meta.fullExchangeName === 'string'
			? meta.fullExchangeName
			: typeof meta.exchangeName === 'string'
				? meta.exchangeName
				: null;

	return {
		symbol: typeof meta.symbol === 'string' ? meta.symbol : requested,
		name: shortName ?? longName,
		currency: typeof meta.currency === 'string' ? meta.currency : 'USD',
		exchange,
		price,
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

async function pullQuote(symbol: string): Promise<YahooQuote> {
	const res = await fetch(chartUrl(symbol), {
		headers: {
			accept: 'application/json',
			'user-agent': 'threethirds-api'
		},
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	});

	if (!res.ok) {
		throw new Error(`upstream responded ${res.status}`);
	}

	const payload = await res.json();
	return readQuote(payload, symbol, Date.now());
}

export async function loadYahooQuote(symbol: string): Promise<YahooQuote> {
	const key = symbol.toUpperCase();
	const now = Date.now();
	const box = boxes.get(key);

	if (box && now < box.goodUntil) {
		return { ...box.quote, fromCache: true, stale: false };
	}

	try {
		const fresh = await pullQuote(key);
		boxes.set(key, { quote: fresh, goodUntil: fresh.fetchedAt + CACHE_FOR_MS });
		return fresh;
	} catch (err) {
		if (box) {
			return { ...box.quote, fromCache: true, stale: true };
		}
		throw err;
	}
}

export function quoteFields(quote: YahooQuote, amount = 1) {
	return {
		symbol: quote.symbol,
		name: quote.name,
		exchange: quote.exchange,
		currency: quote.currency,
		price: quote.price,
		previousClose: quote.previousClose,
		change: quote.change == null ? null : roundTo(quote.change, 4),
		changePercent: quote.changePercent == null ? null : roundTo(quote.changePercent, 4),
		dayHigh: quote.dayHigh,
		dayLow: quote.dayLow,
		updatedAt: quote.updatedAt,
		amount,
		total: roundTo(quote.price * amount, 4),
		cached: quote.fromCache,
		stale: quote.stale,
		ageMs: Date.now() - quote.fetchedAt
	};
}

export function upstreamError(err: unknown, error: string) {
	const details = err instanceof Error ? err.message : String(err);
	return { ok: false, error, details } as const;
}
