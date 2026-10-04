<script lang="ts">
    import type { PageProps } from './$types';
    	import ApiCard from "$lib/components/apicard.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
      import Tryapi from '$lib/components/tryapi.svelte';
    let { data }: PageProps = $props();
    const api = $derived(data.api);
    const pageUrl = $derived(`https://api.threethirds.dev/docs/${api.id}`);

    const methods: Record<string, string> = {
        GET: 'text-green-500',
        POST: 'text-blue-500',
    };
</script>

<svelte:head>
	<title>{api.name} - Threethirds API</title>
	<meta name="description" content={api.description} />

	<meta property="og:title" content={api.name} />
	<meta property="og:description" content={api.description} />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={`https://api.threethirds.dev/og/${api.id}`} />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:width" content="1200" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={api.name} />
	<meta name="twitter:description" content={api.description} />
</svelte:head>

<ApiCard {api} />
