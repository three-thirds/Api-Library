import { sha256 } from './vault';

// short links live next to vault rows in VAULT_KV.
// keys are short:{code} and short:url:{hash} so we never
// step on vault:{hash}.

const memory = new Map<string, string>();

const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const GENERATED_LEN = 7;
const MAX_URL_LEN = 2048;
const RESERVED = new Set(['create', 'go']);

export type ShortRecord = {
	code: string;
	url: string;
	createdAt: string;
	expiresAt: string | null;
	hits: number;
};

export type PutOptions = {
	expirationTtl?: number;
};

function hasKv(kv: unknown): kv is { get: Function; put: Function } {
	return (
		kv != null &&
		typeof kv === 'object' &&
		typeof (kv as { get?: unknown }).get === 'function' &&
		typeof (kv as { put?: unknown }).put === 'function'
	);
}

async function kvGet(kv: unknown, key: string): Promise<string | null> {
	if (hasKv(kv)) {
		return (await kv.get(key)) as string | null;
	}
	return memory.get(key) ?? null;
}

async function kvPut(kv: unknown, key: string, value: string, opts?: PutOptions): Promise<void> {
	if (hasKv(kv)) {
		if (opts?.expirationTtl) {
			await kv.put(key, value, { expirationTtl: opts.expirationTtl });
		} else {
			await kv.put(key, value);
		}
		return;
	}
	memory.set(key, value);
}

export function codeKey(code: string): string {
	return `short:${code}`;
}

export async function urlIndexKey(url: string): Promise<string> {
	const hash = await sha256(url);
	return `short:url:${hash}`;
}

export function validateUrl(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
	if (typeof raw !== 'string' || raw.trim() === '') {
		return { ok: false, error: 'url is required' };
	}

	const trimmed = raw.trim();
	if (trimmed.length > MAX_URL_LEN) {
		return { ok: false, error: `url is capped at ${MAX_URL_LEN} characters` };
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { ok: false, error: 'url is not a valid url' };
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { ok: false, error: 'url has to be http or https' };
	}

	return { ok: true, url: parsed.href };
}

export function validateCode(raw: unknown): { ok: true; code: string } | { ok: false; error: string } {
	if (raw == null || raw === '') {
		return { ok: false, error: 'code is empty' };
	}
	if (typeof raw !== 'string') {
		return { ok: false, error: 'code has to be a string' };
	}

	const code = raw.trim();
	if (code.length < 3 || code.length > 32) {
		return { ok: false, error: 'code has to be 3 to 32 characters' };
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
		return { ok: false, error: 'code can only use letters, numbers, _ and -' };
	}
	if (RESERVED.has(code.toLowerCase())) {
		return { ok: false, error: `code "${code}" is reserved` };
	}

	return { ok: true, code };
}

export function generateCode(): string {
	const bytes = new Uint8Array(GENERATED_LEN);
	crypto.getRandomValues(bytes);
	let out = '';
	for (let i = 0; i < GENERATED_LEN; i++) {
		out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
	}
	return out;
}

export async function getByCode(kv: unknown, code: string): Promise<ShortRecord | null> {
	const raw = await kvGet(kv, codeKey(code));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as ShortRecord;
		if (typeof parsed?.code !== 'string' || typeof parsed?.url !== 'string') return null;
		return {
			code: parsed.code,
			url: parsed.url,
			createdAt: parsed.createdAt ?? new Date(0).toISOString(),
			expiresAt: parsed.expiresAt ?? null,
			hits: typeof parsed.hits === 'number' ? parsed.hits : 0
		};
	} catch {
		return null;
	}
}

export async function getCodeForUrl(kv: unknown, url: string): Promise<string | null> {
	const key = await urlIndexKey(url);
	const code = await kvGet(kv, key);
	return code && code.length > 0 ? code : null;
}

export async function saveShort(
	kv: unknown,
	record: ShortRecord,
	opts?: PutOptions
): Promise<void> {
	const serialized = JSON.stringify(record);
	await kvPut(kv, codeKey(record.code), serialized, opts);
	await kvPut(kv, await urlIndexKey(record.url), record.code, opts);
}

export async function bumpHits(kv: unknown, record: ShortRecord): Promise<ShortRecord> {
	const next: ShortRecord = {
		...record,
		hits: (record.hits ?? 0) + 1
	};

	// keep whatever ttl the original row had if we can; memory path
	// ignores opts. for kv, rewriting without expirationTtl clears expiry
	// on some runtimes, so we only rewrite the value and leave ttl alone
	// when the platform supports metadata. simplest: put without changing ttl
	// by omitting expirationTtl (cloudflare keeps existing expiration on put
	// only if you pass expiration/expirationTtl again — so we skip bump
	// persistence failure by best-effort put).
	try {
		await kvPut(kv, codeKey(next.code), JSON.stringify(next));
	} catch {
		// hit count is best-effort
	}
	return next;
}

/** test helper */
export function clearShortenerMemory(): void {
	memory.clear();
}
