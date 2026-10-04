import { Hono } from 'hono';
import { encode as encodePng } from 'fast-png';
import { encode } from 'uqr';

// stick some text in, get a qr code back as svg or png.
// workers can't do canvas, so we draw the modules ourselves.

const MAX_TEXT = 1024;

// hex, plain rgb(), or a short color name. no url() tricks, no ; for css injection.
const COLOR_OK =
	/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-zA-Z]{1,20})$/;

// enough named colors for png. svg can still take the string as-is.
const NAMED: Record<string, [number, number, number]> = {
	black: [0, 0, 0],
	white: [255, 255, 255],
	red: [255, 0, 0],
	green: [0, 128, 0],
	blue: [0, 0, 255],
	yellow: [255, 255, 0],
	cyan: [0, 255, 255],
	magenta: [255, 0, 255],
	gray: [128, 128, 128],
	grey: [128, 128, 128],
	orange: [255, 165, 0],
	purple: [128, 0, 128],
	pink: [255, 192, 203],
	brown: [165, 42, 42],
	navy: [0, 0, 128],
	teal: [0, 128, 128],
	lime: [0, 255, 0],
	maroon: [128, 0, 0],
	olive: [128, 128, 0],
	silver: [192, 192, 192],
	aqua: [0, 255, 255],
	fuchsia: [255, 0, 255]
};

const qr = new Hono();

function scrub(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function colorOk(raw: string): boolean {
	const v = raw.trim();
	if (!v || v.includes(';') || /url\s*\(/i.test(v)) return false;
	return COLOR_OK.test(v);
}

function parseColor(raw: string): [number, number, number] | null {
	const v = raw.trim();
	if (/^#[0-9a-fA-F]{3}$/.test(v)) {
		return [
			parseInt(v[1] + v[1], 16),
			parseInt(v[2] + v[2], 16),
			parseInt(v[3] + v[3], 16)
		];
	}
	if (/^#[0-9a-fA-F]{6}$/.test(v)) {
		return [
			parseInt(v.slice(1, 3), 16),
			parseInt(v.slice(3, 5), 16),
			parseInt(v.slice(5, 7), 16)
		];
	}
	const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(v);
	if (rgb) {
		const r = Number(rgb[1]);
		const g = Number(rgb[2]);
		const b = Number(rgb[3]);
		if (r > 255 || g > 255 || b > 255) return null;
		return [r, g, b];
	}
	return NAMED[v.toLowerCase()] ?? null;
}

function readInt(
	raw: string | undefined,
	fallback: number,
	min: number,
	max: number,
	name: string
): { ok: true; n: number } | { ok: false; error: string } {
	if (raw == null || raw === '') return { ok: true, n: fallback };
	if (!/^-?\d+$/.test(raw)) {
		return { ok: false, error: `${name} has to be an integer from ${min} to ${max}` };
	}
	const n = Number(raw);
	if (!Number.isInteger(n) || n < min || n > max) {
		return { ok: false, error: `${name} has to be an integer from ${min} to ${max}` };
	}
	return { ok: true, n };
}

// one path for every dark module. size is the final px width/height.
function toSvg(data: boolean[][], modules: number, size: number, dark: string, light: string): string {
	const cell = size / modules;
	const bits: string[] = [];
	for (let y = 0; y < modules; y++) {
		for (let x = 0; x < modules; x++) {
			if (!data[y][x]) continue;
			bits.push(`M${x * cell},${y * cell}h${cell}v${cell}h-${cell}z`);
		}
	}
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
		`<rect fill="${scrub(light)}" width="${size}" height="${size}"/>` +
		`<path fill="${scrub(dark)}" d="${bits.join('')}"/>` +
		`</svg>`
	);
}

function toPng(
	data: boolean[][],
	modules: number,
	size: number,
	dark: [number, number, number],
	light: [number, number, number]
): Uint8Array {
	const pixels = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) {
		const my = Math.min(modules - 1, Math.floor((y * modules) / size));
		for (let x = 0; x < size; x++) {
			const mx = Math.min(modules - 1, Math.floor((x * modules) / size));
			const [r, g, b] = data[my][mx] ? dark : light;
			const i = (y * size + x) * 4;
			pixels[i] = r;
			pixels[i + 1] = g;
			pixels[i + 2] = b;
			pixels[i + 3] = 255;
		}
	}
	return encodePng({ width: size, height: size, data: pixels });
}

qr.get('/', (c) => {
	const text = c.req.query('text');

	if (text == null) {
		return c.json({
			ok: true,
			method: 'GET',
			path: '/api/v1/qr',
			query: {
				text: 'required, max 1024 chars',
				size: 'optional px, 64-1024, default 256',
				ecc: 'optional L|M|Q|H, default M',
				margin: 'optional quiet zone, 0-8, default 2',
				dark: 'optional module color, default #000000',
				light: 'optional background, default #ffffff',
				format: 'optional svg|png|json, default svg'
			},
			example: '/api/v1/qr?text=https%3A%2F%2Fthreethirds.dev&size=256',
			notes: [
				'default response is image/svg+xml',
				'format=png returns image/png',
				'format=json wraps the svg and a data uri',
				'works as an img src'
			]
		});
	}

	const payload = text.trim();
	if (!payload) {
		return c.json({ ok: false, error: 'text is required' }, 400);
	}
	if (payload.length > MAX_TEXT) {
		return c.json({ ok: false, error: `text is capped at ${MAX_TEXT} characters` }, 400);
	}

	const size = readInt(c.req.query('size'), 256, 64, 1024, 'size');
	if (!size.ok) return c.json({ ok: false, error: size.error }, 400);

	const margin = readInt(c.req.query('margin'), 2, 0, 8, 'margin');
	if (!margin.ok) return c.json({ ok: false, error: margin.error }, 400);

	const ecc = (c.req.query('ecc') ?? 'M').trim().toUpperCase();
	if (ecc !== 'L' && ecc !== 'M' && ecc !== 'Q' && ecc !== 'H') {
		return c.json({ ok: false, error: 'ecc has to be L, M, Q, or H' }, 400);
	}

	const dark = (c.req.query('dark') ?? '#000000').trim();
	const light = (c.req.query('light') ?? '#ffffff').trim();
	if (!colorOk(dark)) return c.json({ ok: false, error: 'dark color is not allowed' }, 400);
	if (!colorOk(light)) return c.json({ ok: false, error: 'light color is not allowed' }, 400);

	const format = (c.req.query('format') ?? 'svg').trim().toLowerCase();
	if (format !== 'svg' && format !== 'png' && format !== 'json') {
		return c.json({ ok: false, error: 'format has to be svg, png, or json' }, 400);
	}

	let matrix;
	try {
		matrix = encode(payload, { ecc, border: margin.n });
	} catch {
		return c.json({ ok: false, error: 'could not encode that text' }, 400);
	}

	if (format === 'png') {
		const darkRgb = parseColor(dark);
		const lightRgb = parseColor(light);
		if (!darkRgb) return c.json({ ok: false, error: 'dark color could not be used for png' }, 400);
		if (!lightRgb) return c.json({ ok: false, error: 'light color could not be used for png' }, 400);

		const png = toPng(matrix.data, matrix.size, size.n, darkRgb, lightRgb);
		c.header('Content-Type', 'image/png');
		c.header('Cache-Control', 'public, max-age=3600');
		c.header('Content-Disposition', 'attachment; filename="qr.png"');
		return c.body(png);
	}

	const svg = toSvg(matrix.data, matrix.size, size.n, dark, light);

	if (format === 'json') {
		return c.json({
			ok: true,
			text: payload,
			size: size.n,
			ecc,
			svg,
			dataUri: `data:image/svg+xml;base64,${btoa(svg)}`
		});
	}

	c.header('Content-Type', 'image/svg+xml; charset=utf-8');
	c.header('Cache-Control', 'public, max-age=3600');
	// so "save as" / opening the url gives a real filename, not a blank tab dump
	c.header('Content-Disposition', 'attachment; filename="qr.svg"');
	return c.body(svg);
});

export default qr;
