import { Hono } from 'hono';
import {
	bumpHits,
	generateCode,
	getByCode,
	getCodeForUrl,
	saveShort,
	validateCode,
	validateUrl,
	type ShortRecord
} from '../lib/shortener';

// paste a long url, get a short code backed by VAULT_KV.
// /go redirects. the plain /:code path just returns json.

const MAX_TTL_DAYS = 365;

type Env = {
	Bindings: {
		VAULT_KV?: unknown;
	};
};

const short = new Hono<Env>();

function kvFrom(c: { env: Env['Bindings'] }): unknown {
	return (c.env as { VAULT_KV?: unknown } | undefined)?.VAULT_KV;
}

function pathsFor(code: string) {
	return {
		shortPath: `/api/v1/short/${code}/go`,
		infoPath: `/api/v1/short/${code}`
	};
}

function readTtlDays(raw: unknown): { ok: true; days: number | null } | { ok: false; error: string } {
	if (raw == null || raw === '') return { ok: true, days: null };
	const days = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(days) || days <= 0) {
		return { ok: false, error: 'ttlDays has to be a positive number' };
	}
	if (days > MAX_TTL_DAYS) {
		return { ok: false, error: `ttlDays is capped at ${MAX_TTL_DAYS}` };
	}
	return { ok: true, days: Math.floor(days) };
}

short.get('/', (c) => {
	return c.json({
		ok: true,
		method: 'POST',
		path: '/api/v1/short',
		body: {
			url: 'https://example.com/some/long/path',
			code: 'optional custom slug',
			ttlDays: 'optional, 1 to 365'
		},
		also: {
			info: 'GET /api/v1/short/:code',
			go: 'GET /api/v1/short/:code/go'
		},
		notes: [
			'url must be http or https',
			'code is 3-32 letters, numbers, _ or -',
			'without code we mint a random 7 char one',
			'same url twice returns the existing code'
		]
	});
});

short.post('/', async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ ok: false, error: 'body has to be json' }, 400);
	}

	if (body == null || typeof body !== 'object' || Array.isArray(body)) {
		return c.json({ ok: false, error: 'body has to be a json object' }, 400);
	}

	const record = body as Record<string, unknown>;
	const url = validateUrl(record.url);
	if (!url.ok) return c.json({ ok: false, error: url.error }, 400);

	const ttl = readTtlDays(record.ttlDays);
	if (!ttl.ok) return c.json({ ok: false, error: ttl.error }, 400);

	let custom: string | null = null;
	if (record.code != null && record.code !== '') {
		const code = validateCode(record.code);
		if (!code.ok) return c.json({ ok: false, error: code.error }, 400);
		custom = code.code;
	}

	const kv = kvFrom(c);

	const existingCode = await getCodeForUrl(kv, url.url);
	if (existingCode) {
		const existing = await getByCode(kv, existingCode);
		if (existing) {
			if (custom && custom !== existing.code) {
				return c.json(
					{
						ok: false,
						error: 'that url already has a different code',
						code: existing.code
					},
					409
				);
			}
			return c.json({
				ok: true,
				code: existing.code,
				url: existing.url,
				...pathsFor(existing.code),
				createdAt: existing.createdAt,
				expiresAt: existing.expiresAt,
				existing: true
			});
		}
	}

	if (custom) {
		const taken = await getByCode(kv, custom);
		if (taken) {
			return c.json({ ok: false, error: 'code is already taken' }, 409);
		}
	}

	let code = custom;
	if (!code) {
		for (let i = 0; i < 5; i++) {
			const candidate = generateCode();
			const clash = await getByCode(kv, candidate);
			if (!clash) {
				code = candidate;
				break;
			}
		}
		if (!code) {
			return c.json({ ok: false, error: 'could not mint a free code' }, 500);
		}
	}

	const createdAt = new Date().toISOString();
	const expiresAt =
		ttl.days == null ? null : new Date(Date.now() + ttl.days * 86400 * 1000).toISOString();

	const saved: ShortRecord = {
		code,
		url: url.url,
		createdAt,
		expiresAt,
		hits: 0
	};

	const putOpts = ttl.days == null ? undefined : { expirationTtl: ttl.days * 86400 };

	try {
		await saveShort(kv, saved, putOpts);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return c.json({ ok: false, error: 'could not save the short link', detail: message }, 500);
	}

	return c.json(
		{
			ok: true,
			code: saved.code,
			url: saved.url,
			...pathsFor(saved.code),
			createdAt: saved.createdAt,
			expiresAt: saved.expiresAt,
			existing: false
		},
		201
	);
});

short.get('/:code/go', async (c) => {
	const checked = validateCode(c.req.param('code'));
	if (!checked.ok) {
		return c.json({ ok: false, error: 'unknown code' }, 404);
	}

	const kv = kvFrom(c);
	const found = await getByCode(kv, checked.code);
	if (!found) {
		return c.json({ ok: false, error: 'unknown code' }, 404);
	}

	await bumpHits(kv, found);
	return c.redirect(found.url, 302);
});

short.get('/:code', async (c) => {
	const checked = validateCode(c.req.param('code'));
	if (!checked.ok) {
		return c.json({ ok: false, error: 'unknown code' }, 404);
	}

	const kv = kvFrom(c);
	const found = await getByCode(kv, checked.code);
	if (!found) {
		return c.json({ ok: false, error: 'unknown code' }, 404);
	}

	const next = await bumpHits(kv, found);
	return c.json({
		ok: true,
		code: next.code,
		url: next.url,
		createdAt: next.createdAt,
		expiresAt: next.expiresAt,
		hits: next.hits
	});
});

export default short;
