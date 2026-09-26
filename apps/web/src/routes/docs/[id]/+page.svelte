<script lang="ts">
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const api = $derived(data.api);
    const pageUrl = $derived(`https://api-library.vercel.app/docs/${api.id}`);
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

<p>{data.api.name}</p>