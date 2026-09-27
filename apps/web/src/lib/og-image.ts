import { ImageResponse } from '@ethercorps/sveltekit-og';
import SimpleCard from './components/apiog.svelte';
import type { ComponentProps } from 'svelte';
import type { RequestHandler } from '@sveltejs/kit';

type OgProps = ComponentProps<typeof SimpleCard>;

export const createOgImageHandler = (props: OgProps): RequestHandler => {
  return async () => {
    try {
      return await new ImageResponse(SimpleCard, { width: 1200, height: 630 }, props);
    } catch (error) {
      console.error('Error generating OG image:', error);
      return new Response('Failed to generate OG image', { status: 500 });
    }
  };
};