import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	  define: {
    'globalThis.EdgeRuntime': JSON.stringify('vite-dev'),
  },
	resolve: {
		conditions: ['worker', 'edge-light']
	},
	ssr: {
		noExternal: ['@vercel/og'],
		resolve: {
			conditions: ['worker', 'edge-light']
		}
	}
});