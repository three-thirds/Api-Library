import { Hono } from 'hono';
import { loadYahooQuote, quoteFields, upstreamError } from '../yahoo';

// These four are the ones people actually mean when they say "the market".
// The yahoo symbols with a caret are indices, not stocks, so they live here
// instead of on /stock.

const INDICES = {
	sp500: { yahoo: '^GSPC', label: 'S&P 500' },
	nasdaq: { yahoo: '^IXIC', label: 'Nasdaq Composite' },
	nifty: { yahoo: '^NSEI', label: 'Nifty 50' },
	sensex: { yahoo: '^BSESN', label: 'BSE Sensex' }
} as const;

type IndexName = keyof typeof INDICES;

const indices = new Hono();

function indexName(raw: string): IndexName | null {
	const name = raw.trim().toLowerCase();
	if (name in INDICES) return name as IndexName;
	return null;
}

indices.get('/', (c) => {
	return c.json({
		ok: true,
		indices: (Object.keys(INDICES) as IndexName[]).map((name) => ({
			name,
			label: INDICES[name].label,
			path: `/api/v1/index/${name}`
		}))
	});
});

indices.get('/:name', async (c) => {
	const name = indexName(c.req.param('name'));
	if (!name) {
		return c.json(
			{
				ok: false,
				error: 'unknown index',
				supported: Object.keys(INDICES)
			},
			400
		);
	}

	const picked = INDICES[name];

	try {
		const quote = await loadYahooQuote(picked.yahoo);
		return c.json({
			ok: true,
			kind: 'index',
			index: name,
			label: picked.label,
			...quoteFields(quote)
		});
	} catch (err) {
		return c.json(upstreamError(err, 'could not load that index'), 502);
	}
});

export default indices;
