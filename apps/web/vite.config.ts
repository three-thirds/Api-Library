import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		conditions: ['worker', 'edge-light']
	},
	ssr: {
		resolve: {
			conditions: ['worker', 'edge-light']
		}
	}
});