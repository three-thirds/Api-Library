import { Hono } from 'hono';
import { loadYahooQuote, roundTo, upstreamError } from '../yahoo';

// you dump what you hold, we mark it to today's spot and tell you
// which line is most of the pile. cash stays cash. everything else
// goes through yahoo the same way stock and regret already do.

const FX = 'INR=X';
const MAX_HOLDINGS = 20;
const MAX_AMOUNT = 1_000_000_000;
const RESULT_CACHE_MS = 60 * 1000;

type Money = 'INR' | 'USD';

type Alias = {
	id: string;
	name: string;
	yahoo: string;
};

const ALIASES: Alias[] = [
	{ id: 'gold', name: 'Gold', yahoo: 'GC=F' },
	{ id: 'silver', name: 'Silver', yahoo: 'SI=F' },
	{ id: 'platinum', name: 'Platinum', yahoo: 'PL=F' },
	{ id: 'copper', name: 'Copper', yahoo: 'HG=F' },
	{ id: 'oil', name: 'WTI crude', yahoo: 'CL=F' },
	{ id: 'gas', name: 'Natural gas', yahoo: 'NG=F' },
	{ id: 'btc', name: 'Bitcoin', yahoo: 'BTC-USD' },
	{ id: 'eth', name: 'Ethereum', yahoo: 'ETH-USD' },
	{ id: 'sp500', name: 'S&P 500', yahoo: '^GSPC' },
	{ id: 'nasdaq', name: 'Nasdaq Composite', yahoo: '^IXIC' },
	{ id: 'nifty', name: 'Nifty 50', yahoo: '^NSEI' },
	{ id: 'sensex', name: 'BSE Sensex', yahoo: '^BSESN' }
];

const ALIAS_BY_ID = new Map(ALIASES.map((a) => [a.id, a]));

type HoldingLine = {
	id: string;
	amount: number;
	kind: 'cash' | 'alias' | 'stock';
	name: string;
	yahoo: string | null;
};

type Priced = {
	id: string;
	name: string;
	symbol: string | null;
	amount: number;
	price: number | null;
	quoteCurrency: string | null;
	value: number;
	weight: number;
};

type Skip = {
	id: string;
	reason: string;
};

const portfolio = new Hono();
const remembered = new Map<string, { body: unknown; goodUntil: number }>();

function cleanStockSymbol(raw: string): string | null {
	const symbol = raw.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) return null;
	if (symbol.startsWith('.') || symbol.endsWith('.') || symbol.includes('..')) return null;
	return symbol;
}

function readCurrency(raw: unknown): { ok: true; currency: Money } | { ok: false; error: string } {
	if (raw == null || raw === '') return { ok: true, currency: 'INR' };
	if (typeof raw !== 'string') return { ok: false, error: 'currency has to be INR or USD' };

	const currency = raw.trim().toUpperCase();
	if (currency === 'INR' || currency === 'USD') return { ok: true, currency };
	return { ok: false, error: 'currency has to be INR or USD' };
}

function readAmount(raw: unknown, where: string): { ok: true; amount: number } | { ok: false; error: string } {
	const amount = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, error: `${where} amount has to be a positive number` };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `${where} amount is capped at ${MAX_AMOUNT}` };
	}
	return { ok: true, amount };
}

function resolveId(raw: string): HoldingLine | { skip: Skip } {
	const trimmed = raw.trim();
	if (trimmed === '') {
		return { skip: { id: '', reason: 'id was empty' } };
	}

	const lower = trimmed.toLowerCase();
	if (lower === 'cash') {
		return { id: 'cash', amount: 0, kind: 'cash', name: 'Cash', yahoo: null };
	}

	const alias = ALIAS_BY_ID.get(lower);
	if (alias) {
		return { id: alias.id, amount: 0, kind: 'alias', name: alias.name, yahoo: alias.yahoo };
	}

	const symbol = cleanStockSymbol(trimmed);
	if (!symbol) {
		return { skip: { id: trimmed, reason: 'symbol looks wrong' } };
	}

	return { id: symbol, amount: 0, kind: 'stock', name: symbol, yahoo: symbol };
}

function parseBody(body: unknown):
	| { ok: true; currency: Money; lines: HoldingLine[]; earlySkipped: Skip[] }
	| { ok: false; error: string } {
	if (body == null || typeof body !== 'object' || Array.isArray(body)) {
		return { ok: false, error: 'body has to be a json object' };
	}

	const record = body as Record<string, unknown>;
	const currency = readCurrency(record.currency);
	if (!currency.ok) return currency;

	if (!Array.isArray(record.holdings)) {
		return { ok: false, error: 'holdings has to be an array' };
	}
	if (record.holdings.length === 0) {
		return { ok: false, error: 'holdings cannot be empty' };
	}
	if (record.holdings.length > MAX_HOLDINGS) {
		return { ok: false, error: `holdings is capped at ${MAX_HOLDINGS}` };
	}

	const merged = new Map<string, HoldingLine>();
	const earlySkipped: Skip[] = [];

	for (let i = 0; i < record.holdings.length; i++) {
		const item = record.holdings[i];
		if (item == null || typeof item !== 'object' || Array.isArray(item)) {
			return { ok: false, error: `holdings[${i}] has to be an object` };
		}

		const row = item as Record<string, unknown>;
		if (typeof row.id !== 'string') {
			return { ok: false, error: `holdings[${i}].id has to be a string` };
		}

		const amount = readAmount(row.amount, `holdings[${i}]`);
		if (!amount.ok) return amount;

		const resolved = resolveId(row.id);
		if ('skip' in resolved) {
			earlySkipped.push(resolved.skip);
			continue;
		}

		const existing = merged.get(resolved.id);
		if (existing) {
			existing.amount += amount.amount;
		} else {
			merged.set(resolved.id, { ...resolved, amount: amount.amount });
		}
	}

	const lines = [...merged.values()];
	if (lines.length === 0 && earlySkipped.length > 0) {
		// every row was junk; still return ok parse so POST can 502 with skipped
		return { ok: true, currency: currency.currency, lines, earlySkipped };
	}
	if (lines.length === 0) {
		return { ok: false, error: 'holdings cannot be empty' };
	}

	return { ok: true, currency: currency.currency, lines, earlySkipped };
}

function convertValue(
	valueInQuote: number,
	quoteCurrency: string,
	want: Money,
	usdInr: number
): { ok: true; value: number } | { ok: false; reason: string } {
	const quote = quoteCurrency.toUpperCase();
	if (quote === want) return { ok: true, value: valueInQuote };
	if (quote === 'USD' && want === 'INR') return { ok: true, value: valueInQuote * usdInr };
	if (quote === 'INR' && want === 'USD') return { ok: true, value: valueInQuote / usdInr };
	return { ok: false, reason: `unsupported quote currency ${quote}` };
}

function needsFx(quoteCurrency: string, want: Money): boolean {
	return quoteCurrency.toUpperCase() !== want;
}

function sayIt(winner: Priced, loser: Priced): string {
	const pct = Math.round(winner.weight * 100);
	if (winner.id === 'cash') {
		return `Cash is ${pct}% of the pile. ${loser.name} is the quiet leftover.`;
	}
	if (loser.id === 'cash') {
		return `${winner.name} is ${pct}% of the pile. Cash is the quiet leftover.`;
	}
	return `${winner.name} is ${pct}% of the pile. ${loser.name} is the smallest slice.`;
}

function cacheKey(currency: Money, lines: HoldingLine[]): string {
	const parts = lines
		.map((line) => `${line.id}:${line.amount}`)
		.sort()
		.join(',');
	return `${currency}|${parts}`;
}

portfolio.get('/', (c) => {
	return c.json({
		ok: true,
		method: 'POST',
		path: '/api/v1/portfolio',
		body: {
			currency: 'INR or USD, defaults to INR',
			holdings: [{ id: 'gold|btc|AAPL|cash|...', amount: 1 }]
		},
		aliases: ALIASES.map((a) => ({ id: a.id, name: a.name, symbol: a.yahoo })),
		notes: [
			'gold, silver, and platinum amounts are troy ounces',
			'copper amount is pounds',
			'anything that is not an alias is treated as a stock ticker'
		]
	});
});

portfolio.post('/', async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ ok: false, error: 'body has to be json' }, 400);
	}

	const parsed = parseBody(body);
	if (!parsed.ok) {
		return c.json({ ok: false, error: parsed.error }, 400);
	}

	const { currency, lines, earlySkipped } = parsed;
	const key = cacheKey(currency, lines);
	const hit = remembered.get(key);
	if (hit && Date.now() < hit.goodUntil) {
		return c.json(hit.body);
	}

	const skipped: Skip[] = [...earlySkipped];
	const priced: Priced[] = [];

	const needsQuote = lines.filter((line) => line.kind !== 'cash');
	const quoteResults = await Promise.all(
		needsQuote.map(async (line) => {
			try {
				const quote = await loadYahooQuote(line.yahoo!);
				return { line, ok: true as const, quote };
			} catch (err) {
				const reason = err instanceof Error ? err.message : String(err);
				return { line, ok: false as const, reason };
			}
		})
	);

	let usdInr: number | null = null;
	const anyNeedsFx = quoteResults.some(
		(r) => r.ok && needsFx(r.quote.currency, currency)
	);

	if (anyNeedsFx) {
		try {
			const fx = await loadYahooQuote(FX);
			usdInr = fx.price;
		} catch (err) {
			return c.json(upstreamError(err, 'could not load the rupee rate'), 502);
		}
	}

	for (const result of quoteResults) {
		if (!result.ok) {
			skipped.push({ id: result.line.id, reason: result.reason });
			continue;
		}

		const valueInQuote = result.quote.price * result.line.amount;
		if (needsFx(result.quote.currency, currency)) {
			const converted = convertValue(valueInQuote, result.quote.currency, currency, usdInr!);
			if (!converted.ok) {
				skipped.push({ id: result.line.id, reason: converted.reason });
				continue;
			}
			priced.push({
				id: result.line.id,
				name: result.line.kind === 'stock' ? result.quote.name || result.line.name : result.line.name,
				symbol: result.quote.symbol,
				amount: result.line.amount,
				price: roundTo(result.quote.price, 4),
				quoteCurrency: result.quote.currency,
				value: roundTo(converted.value, 2),
				weight: 0
			});
		} else {
			priced.push({
				id: result.line.id,
				name: result.line.kind === 'stock' ? result.quote.name || result.line.name : result.line.name,
				symbol: result.quote.symbol,
				amount: result.line.amount,
				price: roundTo(result.quote.price, 4),
				quoteCurrency: result.quote.currency,
				value: roundTo(valueInQuote, 2),
				weight: 0
			});
		}
	}

	for (const line of lines) {
		if (line.kind !== 'cash') continue;
		priced.push({
			id: 'cash',
			name: currency === 'INR' ? 'Rupees under the mattress' : 'Dollars under the mattress',
			symbol: null,
			amount: line.amount,
			price: null,
			quoteCurrency: currency,
			value: roundTo(line.amount, 2),
			weight: 0
		});
	}

	// cash-only is fine. if we asked yahoo for anything and every quote
	// failed, that is a 502 even when cash is sitting next to them.
	if (priced.length === 0 || (needsQuote.length > 0 && priced.every((row) => row.id === 'cash'))) {
		return c.json(
			{
				ok: false,
				error: 'none of those holdings had a price',
				skipped
			},
			502
		);
	}

	const total = roundTo(
		priced.reduce((sum, row) => sum + row.value, 0),
		2
	);

	for (const row of priced) {
		row.weight = total === 0 ? 0 : roundTo(row.value / total, 4);
	}

	let winner = priced[0];
	let loser = priced[0];
	for (const row of priced) {
		if (row.weight > winner.weight) winner = row;
		if (row.weight < loser.weight) loser = row;
	}

	const response = {
		ok: true,
		currency,
		total,
		holdings: priced,
		skipped,
		winner: { id: winner.id, weight: winner.weight },
		loser: { id: loser.id, weight: loser.weight },
		verdict: sayIt(winner, loser)
	};

	remembered.set(key, { body: response, goodUntil: Date.now() + RESULT_CACHE_MS });
	return c.json(response);
});

export default portfolio;
