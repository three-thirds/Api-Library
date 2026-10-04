import { Hono } from 'hono';
import { loadYahooQuote, roundTo, upstreamError } from '../yahoo';

// dinner bill in one currency, each person gets what they owe in
// that currency plus the other one via today's rupee rate.

const FX = 'INR=X';
const MAX_PEOPLE = 20;
const MAX_TOTAL = 1_000_000_000;
const SHARE_TOLERANCE = 0.001;
const RESULT_CACHE_MS = 60 * 1000;

type Money = 'INR' | 'USD';

type PersonIn = {
	name: string;
	share: number | 'equal';
};

type PersonOut = {
	name: string;
	share: number;
	owes: number;
	owesInr: number;
	owesUsd: number;
};

const split = new Hono();
const remembered = new Map<string, { body: unknown; goodUntil: number }>();

function readCurrency(raw: unknown): { ok: true; currency: Money } | { ok: false; error: string } {
	if (raw == null || raw === '') return { ok: true, currency: 'INR' };
	if (typeof raw !== 'string') return { ok: false, error: 'currency has to be INR or USD' };
	const currency = raw.trim().toUpperCase();
	if (currency === 'INR' || currency === 'USD') return { ok: true, currency };
	return { ok: false, error: 'currency has to be INR or USD' };
}

function readTotal(raw: unknown): { ok: true; total: number } | { ok: false; error: string } {
	const total = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(total) || total <= 0) {
		return { ok: false, error: 'total has to be a positive number' };
	}
	if (total > MAX_TOTAL) {
		return { ok: false, error: `total is capped at ${MAX_TOTAL}` };
	}
	return { ok: true, total };
}

function readShare(raw: unknown, where: string): { ok: true; share: number | 'equal' } | { ok: false; error: string } {
	if (typeof raw === 'string' && raw.trim().toLowerCase() === 'equal') {
		return { ok: true, share: 'equal' };
	}
	const share = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(share) || share <= 0 || share > 1) {
		return { ok: false, error: `${where} share has to be between 0 and 1, or the word equal` };
	}
	return { ok: true, share };
}

function parseBody(body: unknown):
	| { ok: true; total: number; currency: Money; people: PersonIn[] }
	| { ok: false; error: string } {
	if (body == null || typeof body !== 'object' || Array.isArray(body)) {
		return { ok: false, error: 'body has to be a json object' };
	}

	const record = body as Record<string, unknown>;
	const total = readTotal(record.total);
	if (!total.ok) return total;

	const currency = readCurrency(record.currency);
	if (!currency.ok) return currency;

	if (!Array.isArray(record.people)) {
		return { ok: false, error: 'people has to be an array' };
	}
	if (record.people.length === 0) {
		return { ok: false, error: 'people cannot be empty' };
	}
	if (record.people.length > MAX_PEOPLE) {
		return { ok: false, error: `people is capped at ${MAX_PEOPLE}` };
	}

	// merge duplicate names. if one row was equal and another had a
	// number, the number wins and we drop equal for that name.
	type Acc = { name: string; fixed: number; equal: boolean };
	const merged = new Map<string, Acc>();

	for (let i = 0; i < record.people.length; i++) {
		const item = record.people[i];
		if (item == null || typeof item !== 'object' || Array.isArray(item)) {
			return { ok: false, error: `people[${i}] has to be an object` };
		}
		const row = item as Record<string, unknown>;
		if (typeof row.name !== 'string' || row.name.trim() === '') {
			return { ok: false, error: `people[${i}].name has to be a non-empty string` };
		}

		const share = readShare(row.share, `people[${i}]`);
		if (!share.ok) return share;

		const name = row.name.trim();
		const key = name.toLowerCase();
		const existing = merged.get(key);
		if (!existing) {
			merged.set(key, {
				name,
				fixed: share.share === 'equal' ? 0 : share.share,
				equal: share.share === 'equal'
			});
			continue;
		}

		if (share.share === 'equal') {
			if (existing.fixed === 0) existing.equal = true;
		} else {
			existing.fixed += share.share;
			existing.equal = false;
		}
	}

	const people: PersonIn[] = [];
	for (const acc of merged.values()) {
		if (acc.equal && acc.fixed === 0) {
			people.push({ name: acc.name, share: 'equal' });
		} else if (acc.fixed > 0) {
			if (acc.fixed > 1) {
				return { ok: false, error: `share for ${acc.name} went over 1` };
			}
			people.push({ name: acc.name, share: acc.fixed });
		}
	}

	if (people.length === 0) {
		return { ok: false, error: 'people cannot be empty' };
	}

	const fixedSum = people
		.filter((p) => p.share !== 'equal')
		.reduce((sum, p) => sum + (p.share as number), 0);
	const equalCount = people.filter((p) => p.share === 'equal').length;

	if (equalCount === 0) {
		if (Math.abs(fixedSum - 1) > SHARE_TOLERANCE) {
			return { ok: false, error: 'shares have to add up to 1' };
		}
	} else {
		if (fixedSum >= 1 - SHARE_TOLERANCE) {
			return { ok: false, error: 'fixed shares already fill the bill; nothing left for equal' };
		}
		if (fixedSum < 0) {
			return { ok: false, error: 'shares have to add up to 1' };
		}
	}

	return { ok: true, total: total.total, currency: currency.currency, people };
}

function assignShares(people: PersonIn[]): { name: string; share: number }[] {
	const fixedSum = people
		.filter((p) => p.share !== 'equal')
		.reduce((sum, p) => sum + (p.share as number), 0);
	const equalPeople = people.filter((p) => p.share === 'equal');
	const leftover = Math.max(0, 1 - fixedSum);
	const eachEqual = equalPeople.length === 0 ? 0 : leftover / equalPeople.length;

	const out: { name: string; share: number }[] = [];
	for (const person of people) {
		if (person.share === 'equal') {
			out.push({ name: person.name, share: eachEqual });
		} else {
			out.push({ name: person.name, share: person.share });
		}
	}

	// nudge the last row so floating point does not leave a paisa on the table
	const sum = out.reduce((s, p) => s + p.share, 0);
	if (out.length > 0 && Math.abs(sum - 1) > 0 && Math.abs(sum - 1) < 0.01) {
		out[out.length - 1].share = roundTo(out[out.length - 1].share + (1 - sum), 6);
	}

	return out;
}

function toBoth(owes: number, currency: Money, usdInr: number): { owesInr: number; owesUsd: number } {
	if (currency === 'INR') {
		return { owesInr: roundTo(owes, 2), owesUsd: roundTo(owes / usdInr, 2) };
	}
	return { owesInr: roundTo(owes * usdInr, 2), owesUsd: roundTo(owes, 2) };
}

function sayIt(people: PersonOut[], currency: Money): string {
	let top = people[0];
	for (const person of people) {
		if (person.owes > top.owes) top = person;
	}
	const unit = currency === 'INR' ? 'rupees' : 'dollars';
	if (people.length === 1) {
		return `${top.name} covers the whole bill (${top.owes} ${unit}).`;
	}
	return `${top.name} pays the most (${top.owes} ${unit}).`;
}

function cacheKey(total: number, currency: Money, people: PersonIn[]): string {
	const parts = people
		.map((p) => `${p.name.toLowerCase()}:${p.share}`)
		.sort()
		.join(',');
	return `${total}|${currency}|${parts}`;
}

split.get('/', (c) => {
	return c.json({
		ok: true,
		method: 'POST',
		path: '/api/v1/split',
		body: {
			total: 3000,
			currency: 'INR or USD, defaults to INR',
			people: [
				{ name: 'a', share: 0.5 },
				{ name: 'b', share: 'equal' }
			]
		},
		notes: [
			'share is a fraction of the bill (0 to 1), or the string equal',
			'fixed shares plus equal shares must cover the whole bill',
			'each person gets owes in the request currency, plus owesInr and owesUsd'
		]
	});
});

split.post('/', async (c) => {
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

	const { total, currency, people } = parsed;
	const key = cacheKey(total, currency, people);
	const hit = remembered.get(key);
	if (hit && Date.now() < hit.goodUntil) {
		return c.json(hit.body);
	}

	let usdInr: number;
	try {
		const fx = await loadYahooQuote(FX);
		usdInr = fx.price;
	} catch (err) {
		return c.json(upstreamError(err, 'could not load the rupee rate'), 502);
	}

	const shares = assignShares(people);
	const rows: PersonOut[] = shares.map((person) => {
		const owes = roundTo(total * person.share, 2);
		const both = toBoth(owes, currency, usdInr);
		return {
			name: person.name,
			share: roundTo(person.share, 4),
			owes,
			owesInr: both.owesInr,
			owesUsd: both.owesUsd
		};
	});

	// fix rounding so owes sum to total
	const owedSum = rows.reduce((s, r) => s + r.owes, 0);
	const drift = roundTo(total - owedSum, 2);
	if (rows.length > 0 && drift !== 0) {
		rows[rows.length - 1].owes = roundTo(rows[rows.length - 1].owes + drift, 2);
		const both = toBoth(rows[rows.length - 1].owes, currency, usdInr);
		rows[rows.length - 1].owesInr = both.owesInr;
		rows[rows.length - 1].owesUsd = both.owesUsd;
	}

	let winner = rows[0];
	for (const row of rows) {
		if (row.owes > winner.owes) winner = row;
	}

	const response = {
		ok: true,
		total,
		currency,
		usdInr: roundTo(usdInr, 4),
		people: rows,
		winner: { name: winner.name, owes: winner.owes },
		verdict: sayIt(rows, currency)
	};

	remembered.set(key, { body: response, goodUntil: Date.now() + RESULT_CACHE_MS });
	return c.json(response);
});

export default split;
