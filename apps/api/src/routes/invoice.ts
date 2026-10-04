import { Hono } from 'hono';
import { loadYahooQuote, roundTo, upstreamError } from '../yahoo';

// weird bill with mixed stuff on it. we price the aliases and tickers,
// keep cash lines as cash, and say what most of the invoice is.

const FX = 'INR=X';
const MAX_LINES = 20;
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

type LineIn = {
	key: string;
	kind: 'cash' | 'alias' | 'stock';
	name: string;
	amount: number;
	yahoo: string | null;
};

type LineOut = {
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

const invoice = new Hono();
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
		return { ok: false, error: `${where} has to be a positive number` };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `${where} is capped at ${MAX_AMOUNT}` };
	}
	return { ok: true, amount };
}

function resolveAssetId(raw: string, amount: number): LineIn | { skip: Skip } {
	const trimmed = raw.trim();
	if (trimmed === '') return { skip: { id: '', reason: 'id was empty' } };

	const lower = trimmed.toLowerCase();
	if (lower === 'cash') {
		return { key: 'cash', kind: 'cash', name: 'Cash', amount, yahoo: null };
	}

	const alias = ALIAS_BY_ID.get(lower);
	if (alias) {
		return { key: alias.id, kind: 'alias', name: alias.name, amount, yahoo: alias.yahoo };
	}

	const symbol = cleanStockSymbol(trimmed);
	if (!symbol) return { skip: { id: trimmed, reason: 'symbol looks wrong' } };

	return { key: symbol, kind: 'stock', name: symbol, amount, yahoo: symbol };
}

function parseBody(body: unknown):
	| { ok: true; currency: Money; lines: LineIn[]; earlySkipped: Skip[] }
	| { ok: false; error: string } {
	if (body == null || typeof body !== 'object' || Array.isArray(body)) {
		return { ok: false, error: 'body has to be a json object' };
	}

	const record = body as Record<string, unknown>;
	const currency = readCurrency(record.currency);
	if (!currency.ok) return currency;

	if (!Array.isArray(record.lines)) {
		return { ok: false, error: 'lines has to be an array' };
	}
	if (record.lines.length === 0) {
		return { ok: false, error: 'lines cannot be empty' };
	}
	if (record.lines.length > MAX_LINES) {
		return { ok: false, error: `lines is capped at ${MAX_LINES}` };
	}

	const merged = new Map<string, LineIn>();
	const earlySkipped: Skip[] = [];

	for (let i = 0; i < record.lines.length; i++) {
		const item = record.lines[i];
		if (item == null || typeof item !== 'object' || Array.isArray(item)) {
			return { ok: false, error: `lines[${i}] has to be an object` };
		}
		const row = item as Record<string, unknown>;

		// plain money line: { label, cash }
		if ('cash' in row || ('label' in row && !('id' in row))) {
			if (typeof row.label !== 'string' || row.label.trim() === '') {
				return { ok: false, error: `lines[${i}].label has to be a non-empty string` };
			}
			const cash = readAmount(row.cash, `lines[${i}].cash`);
			if (!cash.ok) return cash;

			const label = row.label.trim();
			const key = `cash:${label.toLowerCase()}`;
			const existing = merged.get(key);
			if (existing) existing.amount += cash.amount;
			else {
				merged.set(key, {
					key,
					kind: 'cash',
					name: label,
					amount: cash.amount,
					yahoo: null
				});
			}
			continue;
		}

		if (typeof row.id !== 'string') {
			return { ok: false, error: `lines[${i}] needs id, or label+cash` };
		}
		const amount = readAmount(row.amount, `lines[${i}].amount`);
		if (!amount.ok) return amount;

		const resolved = resolveAssetId(row.id, amount.amount);
		if ('skip' in resolved) {
			earlySkipped.push(resolved.skip);
			continue;
		}

		const existing = merged.get(resolved.key);
		if (existing) existing.amount += resolved.amount;
		else merged.set(resolved.key, resolved);
	}

	const lines = [...merged.values()];
	if (lines.length === 0 && earlySkipped.length === 0) {
		return { ok: false, error: 'lines cannot be empty' };
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

function sayIt(lines: LineOut[]): string {
	if (lines.length === 0) return 'Nothing on this invoice priced.';
	let top = lines[0];
	for (const line of lines) {
		if (line.value > top.value) top = line;
	}
	const pct = Math.round(top.weight * 100);
	if (pct >= 50) return `Most of this invoice is ${top.name.toLowerCase()}.`;
	return `${top.name} is the biggest line (${pct}%).`;
}

function cacheKey(currency: Money, lines: LineIn[]): string {
	const parts = lines
		.map((l) => `${l.key}:${l.amount}`)
		.sort()
		.join(',');
	return `${currency}|${parts}`;
}

invoice.get('/', (c) => {
	return c.json({
		ok: true,
		method: 'POST',
		path: '/api/v1/invoice',
		body: {
			currency: 'INR or USD, defaults to INR',
			lines: [
				{ id: 'gold', amount: 1 },
				{ id: 'AAPL', amount: 2 },
				{ label: 'snacks', cash: 500 }
			]
		},
		aliases: ALIASES.map((a) => ({ id: a.id, name: a.name, symbol: a.yahoo })),
		notes: [
			'id lines are aliases or stock tickers, same as /portfolio',
			'label+cash is a plain money line in the request currency',
			'gold/silver/platinum amounts are troy ounces; copper is pounds'
		]
	});
});

invoice.post('/', async (c) => {
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
	const priced: LineOut[] = [];

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
	const anyNeedsFx = quoteResults.some((r) => r.ok && needsFx(r.quote.currency, currency));
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
			skipped.push({ id: result.line.key, reason: result.reason });
			continue;
		}

		const valueInQuote = result.quote.price * result.line.amount;
		let value: number;
		if (needsFx(result.quote.currency, currency)) {
			const converted = convertValue(valueInQuote, result.quote.currency, currency, usdInr!);
			if (!converted.ok) {
				skipped.push({ id: result.line.key, reason: converted.reason });
				continue;
			}
			value = converted.value;
		} else {
			value = valueInQuote;
		}

		priced.push({
			id: result.line.key,
			name: result.line.kind === 'stock' ? result.quote.name || result.line.name : result.line.name,
			symbol: result.quote.symbol,
			amount: result.line.amount,
			price: roundTo(result.quote.price, 4),
			quoteCurrency: result.quote.currency,
			value: roundTo(value, 2),
			weight: 0
		});
	}

	for (const line of lines) {
		if (line.kind !== 'cash') continue;
		priced.push({
			id: line.key,
			name: line.name,
			symbol: null,
			amount: line.amount,
			price: null,
			quoteCurrency: currency,
			value: roundTo(line.amount, 2),
			weight: 0
		});
	}

	if (priced.length === 0) {
		return c.json(
			{
				ok: false,
				error: 'none of those lines had a price',
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

	const response = {
		ok: true,
		currency,
		total,
		lines: priced,
		skipped,
		verdict: sayIt(priced)
	};

	remembered.set(key, { body: response, goodUntil: Date.now() + RESULT_CACHE_MS });
	return c.json(response);
});

export default invoice;
