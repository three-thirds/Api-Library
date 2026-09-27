import { Hono } from 'hono';
import { loadYahooQuote, quoteFields, upstreamError } from '../yahoo';

const COINS = {
	btc: { yahoo: 'BTC-USD', name: 'Bitcoin' },
	eth: { yahoo: 'ETH-USD', name: 'Ethereum' }
} as const;

type CoinName = keyof typeof COINS;

const crypto = new Hono();
const MAX_AMOUNT = 1_000_000;

function coinFromParam(raw: string): CoinName | null {
	switch (raw.trim().toLowerCase()) {
		case 'btc':
		case 'bitcoin':
		case 'btc-usd':
			return 'btc';
		case 'eth':
		case 'ethereum':
		case 'eth-usd':
			return 'eth';
		default:
			return null;
	}
}

function amountFromQuery(raw: string | undefined): { ok: true; amount: number } | { ok: false; error: string } {
	if (raw == null || raw.trim() === '') return { ok: true, amount: 1 };

	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount <= 0) {
		return { ok: false, error: 'amount has to be a positive number of coins' };
	}
	if (amount > MAX_AMOUNT) {
		return { ok: false, error: `amount is capped at ${MAX_AMOUNT}` };
	}
	return { ok: true, amount };
}

crypto.get('/', (c) => {
	return c.json({
		ok: true,
		coins: (Object.keys(COINS) as CoinName[]).map((name) => ({
			name,
			label: COINS[name].name,
			path: `/api/v1/crypto/${name}`
		}))
	});
});

crypto.get('/:symbol', async (c) => {
	const name = coinFromParam(c.req.param('symbol'));
	if (!name) {
		return c.json(
			{
				ok: false,
				error: 'unknown coin',
				supported: ['btc', 'eth']
			},
			400
		);
	}

	const amount = amountFromQuery(c.req.query('amount'));
	if (!amount.ok) {
		return c.json({ ok: false, error: amount.error }, 400);
	}

	const coin = COINS[name];

	try {
		const quote = await loadYahooQuote(coin.yahoo);
		return c.json({
			ok: true,
			kind: 'crypto',
			coin: name,
			label: coin.name,
			...quoteFields(quote, amount.amount)
		});
	} catch (err) {
		return c.json(upstreamError(err, 'could not load that coin'), 502);
	}
});

export default crypto;
