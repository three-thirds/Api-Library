import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { sveltekitOG } from '@ethercorps/sveltekit-og/plugin';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), sveltekitOG()]
});